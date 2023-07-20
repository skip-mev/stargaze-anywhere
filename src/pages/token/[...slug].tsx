/* eslint-disable @next/next/no-img-element */
import { useMemo, useState } from "react";
import * as Select from "@radix-ui/react-select";
import { ASSETS } from "@/config/constants";
import { useCollection, useToken } from "@/stargaze/graphql";
import { useRouter } from "next/router";
import { ethers } from "ethers";
import { useQuery } from "@tanstack/react-query";
import { getPriceFromDefiLlama } from "@/lib/defillama";
import { MsgsRequest, getMessages, getRoute } from "@/solve/api";
import { useChain, useManager } from "@cosmos-kit/react";
import { ChainRecord, WalletStatus } from "@cosmos-kit/core";
import {
  getAddressForChain,
  getChainByID,
  getSigningCosmWasmClient,
} from "@/utils";
import { OfflineSigner } from "@cosmjs/proto-signing";
import { GasPrice } from "@cosmjs/stargate";

function useGetAmount(
  target: number,
  denom: string,
  chainID: string,
  coinGeckoID: string
) {
  return useQuery({
    queryKey: ["get-amount", target, denom, chainID, coinGeckoID],
    queryFn: async () => {
      if (denom === "ustars") {
        return target;
      }

      const starsPrice = await getPriceFromDefiLlama("stargaze");

      const assetPrice = await getPriceFromDefiLlama(coinGeckoID);

      const oneCent = assetPrice / 100;

      let amountInFloat = (target / (assetPrice / starsPrice)) * 1.01;
      let amountOutFloat = 0;

      while (true) {
        const amountIn = ethers
          .parseUnits(amountInFloat.toFixed(6), 6)
          .toString();

        const route = await getRoute({
          amount_in: amountIn,
          source_asset_denom: denom,
          source_asset_chain_id: chainID,
          dest_asset_denom: "ustars",
          dest_asset_chain_id: "stargaze-1",
          cumulative_affiliate_fee_bps: "0",
        });

        amountOutFloat = parseFloat(
          ethers.formatUnits(route.estimated_amount_out as string, 6)
        );

        if (amountOutFloat >= target) {
          break;
        }

        amountInFloat += oneCent;
      }

      return amountInFloat;
    },
  });
}

async function submit(
  amountIn: string,
  denom: string,
  chainID: string,
  collectionAddr: string,
  tokenID: string,
  tokenPrice: string
) {
  if (!window.keplr) {
    throw new Error("Keplr extension is not installed");
  }

  const route = await getRoute({
    amount_in: amountIn,
    source_asset_denom: denom,
    source_asset_chain_id: chainID,
    dest_asset_denom: "ustars",
    dest_asset_chain_id: "stargaze-1",
    cumulative_affiliate_fee_bps: "0",
  });

  await window.keplr.enable(route.chain_ids);

  const userAddresses: Record<string, string> = {};

  // get addresses
  for (const chainID of route.chain_ids) {
    const address = await getAddressForChain(chainID);
    userAddresses[chainID] = address;
  }

  const data: MsgsRequest = {
    source_asset_denom: route.source_asset_denom,
    source_asset_chain_id: route.source_asset_chain_id,
    dest_asset_denom: route.dest_asset_denom,
    dest_asset_chain_id: route.dest_asset_chain_id,

    amount_in: route.amount_in,
    operations: route.operations,

    chain_ids_to_addresses: userAddresses,

    estimated_amount_out: route.estimated_amount_out,
    slippage_tolerance_percent: "5.0",
  };

  const msgsResponse = await getMessages(data);

  for (const multihopMessage of msgsResponse.msgs) {
    let msgJSON = JSON.parse(multihopMessage.msg);

    const buyMsg = {
      buy_now: {
        collection: collectionAddr,
        expires: "1691094968348000000",
        token_id: parseInt(tokenID),
      },
    };

    const transferMsg = {
      transfer_nft: {
        recipient: userAddresses["stargaze-1"],
        token_id: tokenID,
      },
    };

    msgJSON.msg.swap_and_action.post_swap_action.ibc_transfer.ibc_info.receiver =
      "stars1egt2qedl7ygmuhn6a6tshd6qlmhnsalfppwn9w29g9rarw98n55sat2247";

    msgJSON.msg.swap_and_action.post_swap_action.ibc_transfer.ibc_info.memo =
      JSON.stringify({
        wasm: {
          contract:
            "stars1egt2qedl7ygmuhn6a6tshd6qlmhnsalfppwn9w29g9rarw98n55sat2247",
          msg: {
            execute: {
              msgs: [
                {
                  wasm: {
                    execute: {
                      contract_addr:
                        "stars1fvhcnyddukcqfnt7nlwv3thm5we22lyxyxylr9h77cvgkcn43xfsvgv0pl",
                      msg: Buffer.from(JSON.stringify(buyMsg)).toString(
                        "base64"
                      ),
                      funds: [
                        {
                          amount: ethers.parseUnits(tokenPrice, 6).toString(),
                          denom: "ustars",
                        },
                      ],
                    },
                  },
                },
                {
                  wasm: {
                    execute: {
                      contract_addr: collectionAddr,
                      msg: Buffer.from(JSON.stringify(transferMsg)).toString(
                        "base64"
                      ),
                      funds: [],
                    },
                  },
                },
              ],
            },
          },
        },
      });

    const msg = {
      typeUrl: "/cosmwasm.wasm.v1.MsgExecuteContract",
      value: {
        sender: msgJSON.sender,
        contract: msgJSON.contract,
        msg: Uint8Array.from(Buffer.from(JSON.stringify(msgJSON.msg))),
        funds: msgJSON.funds,
      },
    };

    const key = await window.keplr.getKey(multihopMessage.chain_id);
    let signer: OfflineSigner;
    if (key.isNanoLedger) {
      signer = window.keplr.getOfflineSignerOnlyAmino(multihopMessage.chain_id);
    } else {
      signer = window.keplr.getOfflineSigner(multihopMessage.chain_id);
    }

    const chain = getChainByID(multihopMessage.chain_id);

    const feeInfo = chain.fees?.fee_tokens[0];

    if (!feeInfo) {
      throw new Error("No fee info found");
    }

    const client = await getSigningCosmWasmClient(
      multihopMessage.chain_id,
      signer,
      {
        gasPrice: GasPrice.fromString(
          `${feeInfo.average_gas_price}${feeInfo.denom}`
        ),
      }
    );

    const tx = await client.signAndBroadcast(msgJSON.sender, [msg], "auto");

    console.log(tx);
  }
}

function TokenPage() {
  const router = useRouter();

  const [txPending, setTxPending] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(ASSETS[0]);

  const [collectionAddress, tokenID] = useMemo(() => {
    if (!router.query.slug) {
      return ["", ""];
    }

    return router.query.slug as string[];
  }, [router.query.slug]);

  const { data: collection } = useCollection(collectionAddress);

  const { data: token } = useToken(collectionAddress, tokenID);

  const priceFloat = useMemo(() => {
    if (!token) {
      return 0.0;
    }

    return parseFloat(ethers.formatUnits(token.price, 6));
  }, [token]);

  const { data: amountIn, fetchStatus } = useGetAmount(
    priceFloat,
    selectedAsset.id,
    selectedAsset.chainID,
    selectedAsset.coinGeckoId
  );

  const { chainRecords } = useManager();

  const selectedChainRecord = useMemo(() => {
    return chainRecords.find(
      (record) => record.chain.chain_id === selectedAsset.chainID
    );
  }, [chainRecords, selectedAsset.chainID]) as ChainRecord;

  const { status: walletStatus, connect } = useChain(selectedChainRecord.name);

  if (!token || !collection) {
    return null;
  }

  return (
    <div className="max-w-screen-xl mx-auto p-4 py-8">
      <div className="grid grid-cols-2 gap-6 items-center">
        <img className="w-full rounded-xl" src={token.media.url} alt="" />
        <div>
          <p className="font-medium text-sm text-pink-500 mb-1">
            {collection.name}
          </p>
          <div className="flex items-center gap-3 mb-2">
            <p className="font-semibold text-xl">{token.name}</p>
            <div className="flex items-center gap-1">
              <p className="text-zinc-500">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-4 h-4"
                >
                  <path d="M15.5 2A1.5 1.5 0 0014 3.5v13a1.5 1.5 0 001.5 1.5h1a1.5 1.5 0 001.5-1.5v-13A1.5 1.5 0 0016.5 2h-1zM9.5 6A1.5 1.5 0 008 7.5v9A1.5 1.5 0 009.5 18h1a1.5 1.5 0 001.5-1.5v-9A1.5 1.5 0 0010.5 6h-1zM3.5 10A1.5 1.5 0 002 11.5v5A1.5 1.5 0 003.5 18h1A1.5 1.5 0 006 16.5v-5A1.5 1.5 0 004.5 10h-1z" />
                </svg>
              </p>
              <p className="text-sm font-semibold">{token.rarityOrder}</p>
            </div>
          </div>
          <p className="text-sm text-zinc-500 mb-4">{collection.description}</p>
          <div className="py-4 max-w-sm">
            <p className="font-semibold text-zinc-500 mb-2">Buy With:</p>
            <div className="border border-zinc-700 p-3 flex items-center gap-4 rounded-md w-full">
              <Select.Root
                onValueChange={(symbol) => {
                  const nextAsset = ASSETS.find(
                    (asset) => asset.symbol === symbol
                  ) as (typeof ASSETS)[0];

                  setSelectedAsset(nextAsset);
                }}
                value={selectedAsset.symbol}
              >
                <Select.Trigger className="flex items-center border border-zinc-700 w-[200px] text-left rounded-md pr-2 py-2 focus:outline-none hover:border-zinc-600 transition-colors">
                  <div className="px-3">
                    <img alt="" className="w-8 h-8" src={selectedAsset.logo} />
                  </div>
                  <div className="flex-1 font-semibold text-sm">
                    <Select.Value className="" />
                    {/* <p className="text-xs font-semibold text-zinc-500">
                      on Cosmos Hub
                    </p> */}
                  </div>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="w-5 h-5"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                      clipRule="evenodd"
                    />
                  </svg>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content
                    className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden w-52"
                    position="popper"
                    sideOffset={6}
                  >
                    {ASSETS.map((asset) => (
                      <Select.Item
                        className="flex items-center gap-2 text-sm font-semibold p-4 hover:outline-none hover:bg-zinc-800 hover:cursor-pointer focus:outline-none"
                        key={asset.id}
                        value={asset.symbol}
                      >
                        <img
                          className="w-8 h-8 rounded-full overflow-hidden"
                          src={asset.logo}
                          alt=""
                        />
                        <Select.ItemText>{asset.symbol}</Select.ItemText>
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
              <div className="flex-1">
                {fetchStatus === "fetching" && (
                  <div className="flex justify-end pr-3">
                    <svg
                      className="animate-spin h-5 w-5 inline-block text-neutral-300"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                  </div>
                )}
                {fetchStatus !== "fetching" && (
                  <p className="font-semibold">
                    {amountIn && amountIn.toFixed(6)}
                  </p>
                )}
              </div>
            </div>
            <div className="pt-4">
              {walletStatus === WalletStatus.Disconnected && (
                <button
                  className="bg-pink-500 hover:bg-pink-600 font-semibold text-white text-sm py-6 rounded-md w-full transition-colors"
                  onClick={connect}
                >
                  Connect Wallet
                </button>
              )}
              {walletStatus !== WalletStatus.Disconnected && (
                <button
                  className="bg-pink-500 hover:bg-pink-600 font-semibold text-white text-sm h-14 rounded-md w-full transition-colors"
                  onClick={async () => {
                    // if (!swapRoute || !token) {
                    //   return;
                    // }

                    if (!amountIn) {
                      return;
                    }

                    setTxPending(true);
                    try {
                      await submit(
                        ethers.parseUnits(amountIn.toFixed(6), 6).toString(),
                        selectedAsset.id,
                        selectedAsset.chainID,
                        collectionAddress,
                        tokenID,
                        token.price
                        // swapRoute
                      );
                    } finally {
                      setTxPending(false);
                    }
                  }}
                >
                  {txPending ? (
                    <svg
                      className="animate-spin h-5 w-5 inline-block text-neutral-300"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                  ) : (
                    <span>Buy Now</span>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TokenPage;
