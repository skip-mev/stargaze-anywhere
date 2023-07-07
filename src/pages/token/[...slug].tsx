/* eslint-disable @next/next/no-img-element */
import * as Select from "@radix-ui/react-select";
import { useCollection, useToken } from "@/stargaze/graphql";
import {
  formatCompact,
  getAddressForChain,
  getChainByID,
  getSigningCosmWasmClient,
  getSigningStargateClientForChainID,
  getStargateClientForChainID,
} from "@/utils";
import { ethers } from "ethers";
import { useRouter } from "next/router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  SwapMsgsRequest,
  SwapRouteResponse,
  getSwapMessages,
  getSwapRoute,
} from "@/solve/api";
import { useChain, useManager } from "@cosmos-kit/react";
import { ChainRecord, WalletStatus } from "@cosmos-kit/core";
import { IBCDenom } from "@/solve/types";
import { OfflineSigner, coin } from "@cosmjs/proto-signing";
import { GasPrice } from "@cosmjs/stargate";
import BigNumber from "bignumber.js";

const ASSETS = [
  {
    id: "ustars",
    symbol: "STARS",
    logo: "https://raw.githubusercontent.com/cosmostation/chainlist/main/chain/stargaze/asset/stars.png",
    chainID: "stargaze-1",
  },
  {
    id: "uatom",
    symbol: "ATOM",
    logo: "https://raw.githubusercontent.com/cosmostation/chainlist/main/chain/cosmos/asset/atom.png",
    chainID: "cosmoshub-4",
  },
  {
    id: "uosmo",
    symbol: "OSMO",
    logo: "https://raw.githubusercontent.com/cosmostation/chainlist/main/chain/osmosis/asset/osmo.png",
    chainID: "osmosis-1",
  },
  {
    id: "uusdc",
    symbol: "axlUSDC",
    logo: "https://raw.githubusercontent.com/cosmostation/chainlist/main/chain/ethereum/asset/usdc.png",
    chainID: "axelar-dojo-1",
  },
];

function useGetAmount(target: number, denom: string, chainID: string) {
  return useQuery({
    queryKey: ["get-amount", target, denom, chainID],
    queryFn: async () => {
      if (denom === "ustars") {
        return target;
      }

      let low = 0.000001;
      let high = 9999999.999999;

      // let low = 0;
      // let high = targetAmountOut;
      let mid;

      while (low <= high) {
        mid = (low + high) / 2;

        const amountIn = ethers.parseUnits(mid.toFixed(6), 6).toString();

        const response = await getSwapRoute({
          amountIn,
          sourceAsset: {
            denom: denom,
            chainId: chainID,
          },
          destAsset: {
            denom: "ustars",
            chainId: "stargaze-1",
          },
          cumulativeAffiliateFeeBps: "0",
        });

        const amountOut = parseFloat(
          ethers.formatUnits(response.userSwapAmountOut, 6)
        );

        console.log("amountIn", mid);
        console.log("amountOut", amountOut);

        if (amountOut === target) {
          throw new Error("Found an exact match");
          //     return mid; // Found an exact match
        } else if (amountOut < target) {
          low = mid + 0.001; // Adjust the lower bound
        } else {
          high = mid - 0.001; // Adjust the upper bound
        }
      }

      let amountInFloat = low;

      while (true) {
        const amountIn = ethers
          .parseUnits(amountInFloat.toFixed(6), 6)
          .toString();

        const response = await getSwapRoute({
          amountIn,
          sourceAsset: {
            denom: denom,
            chainId: chainID,
          },
          destAsset: {
            denom: "ustars",
            chainId: "stargaze-1",
          },
          cumulativeAffiliateFeeBps: "0",
        });

        const amountOut = parseFloat(
          ethers.formatUnits(response.userSwapAmountOut, 6)
        );

        console.log(amountOut);

        if (amountOut >= target) {
          break;
        }

        amountInFloat += 0.001;
      }

      return amountInFloat;
    },
    refetchInterval: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
    enabled: target !== 0,
  });
}

function useSwapRoute(
  amountIn: string,
  sourceAsset?: IBCDenom,
  destinationAsset?: IBCDenom,
  enabled?: boolean
) {
  return useQuery({
    queryKey: ["solve-swap-route", amountIn, sourceAsset, destinationAsset],
    queryFn: async () => {
      if (!sourceAsset || !destinationAsset) {
        return {} as SwapRouteResponse;
      }

      const response = await getSwapRoute({
        amountIn,
        sourceAsset,
        destAsset: destinationAsset,
        cumulativeAffiliateFeeBps: "0",
      });

      return response;
    },
    refetchInterval: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
    enabled: enabled && !!sourceAsset && !!destinationAsset && amountIn !== "0",
  });
}

async function submit(
  bidAmount: string,
  collectionAddr: string,
  tokenID: string,
  route: SwapRouteResponse
) {
  if (!window.keplr) {
    throw new Error("Keplr extension is not installed");
  }

  // get all chain IDs in path and connect in keplr
  const chainIDs = route.chainIds;

  await window.keplr.enable(chainIDs);

  const userAddresses: Record<string, string> = {};

  // get addresses
  for (const chainID of chainIDs) {
    const address = await getAddressForChain(chainID);
    userAddresses[chainID] = address;
  }

  const data: SwapMsgsRequest = {
    preSwapHops: route.preSwapHops,
    postSwapHops: route.postSwapHops,

    chainIdsToAddresses: userAddresses,

    sourceAsset: route.sourceAsset,
    destAsset: route.destAsset,
    amountIn: route.amountIn,

    userSwap: route.userSwap,
    userSwapAmountOut: route.userSwapAmountOut,
    userSwapSlippageTolerancePercent: "5.0",

    feeSwap: route.feeSwap,
    affiliates: [],
  };

  const msgsResponse = await getSwapMessages(data);

  for (const multihopMessage of msgsResponse.requested) {
    const msgJSON = JSON.parse(multihopMessage.msg);

    // let memo = JSON.parse(msgJSON.memo);

    // memo.wasm.msg.swap_with_action.after_swap_action.ibc_transfer.receiver = "";

    // memo.wasm.msg.swap_with_action.after_swap_action.ibc_transfer.next_memo = {
    //   wasm: {
    //     contract:
    //       "stars1fvhcnyddukcqfnt7nlwv3thm5we22lyxyxylr9h77cvgkcn43xfsvgv0pl",
    //     msg: {
    //       buy_now: {
    //         collection: collectionAddr,
    //         token_id: tokenID,
    //         expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
    //       },
    //     },
    //   },
    // };

    const msg = {
      typeUrl: multihopMessage.msgTypeUrl,
      value: {
        sourcePort: msgJSON.source_port,
        sourceChannel: msgJSON.source_channel,
        token: msgJSON.token,
        sender: msgJSON.sender,
        receiver: msgJSON.receiver,
        timeoutHeight: msgJSON.timeout_height,
        timeoutTimestamp: msgJSON.timeout_timestamp,
        memo: msgJSON.memo,
      },
    };

    const key = await window.keplr.getKey(multihopMessage.chainId);
    let signer: OfflineSigner;
    if (key.isNanoLedger) {
      signer = window.keplr.getOfflineSignerOnlyAmino(multihopMessage.chainId);
    } else {
      signer = window.keplr.getOfflineSigner(multihopMessage.chainId);
    }

    const chain = getChainByID(multihopMessage.chainId);

    const feeInfo = chain.fees?.fee_tokens[0];

    if (!feeInfo) {
      throw new Error("No fee info found");
    }

    const client = await getSigningStargateClientForChainID(
      multihopMessage.chainId,
      signer,
      {
        gasPrice: GasPrice.fromString(
          `${feeInfo.average_gas_price}${feeInfo.denom}`
        ),
      }
    );

    const tx = await client.signAndBroadcast(msgJSON.sender, [msg], "auto");

    const stargazeAddress = userAddresses["stargaze-1"];

    const stargazeClient = await getStargateClientForChainID("stargaze-1");

    const balanceBefore = await stargazeClient.getBalance(
      stargazeAddress,
      "ustars"
    );

    while (true) {
      console.log("polling...");

      const balance = await stargazeClient.getBalance(
        stargazeAddress,
        "ustars"
      );

      if (parseInt(balance.amount) > parseInt(balanceBefore.amount)) {
        break;
      }

      await wait(1000);
    }
  }

  const stargazeSigner = await window.keplr.getOfflineSigner("stargaze-1");

  const cosmwasmClient = await getSigningCosmWasmClient(
    "stargaze-1",
    stargazeSigner,
    {
      gasPrice: GasPrice.fromString(`1ustars`),
    }
  );

  console.log(route.userSwapAmountOut);

  const msg = {
    typeUrl: "/cosmwasm.wasm.v1.MsgExecuteContract",
    value: {
      sender: userAddresses["stargaze-1"],
      contract:
        "stars1fvhcnyddukcqfnt7nlwv3thm5we22lyxyxylr9h77cvgkcn43xfsvgv0pl",
      msg: Uint8Array.from(
        Buffer.from(
          JSON.stringify({
            buy_now: {
              collection: collectionAddr,
              token_id: parseInt(tokenID),
              expires: new BigNumber(Date.now() + 1000 * 60 * 60 * 24 * 7)
                .mul(1000000)
                .toString(),
            },
          })
        )
      ),
      funds: [coin(bidAmount, "ustars")],
    },
  };

  // const tx = await cosmwasmClient.execute(
  //   userAddresses["stargaze-1"],
  //   "stars1fvhcnyddukcqfnt7nlwv3thm5we22lyxyxylr9h77cvgkcn43xfsvgv0pl",
  //   {
  //     buy_now: {
  //       collection: collectionAddr,
  //       token_id: tokenID,
  //       expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
  //     },
  //   },
  //   "auto",
  //   "",
  //   [coin(route.userSwapAmountOut, "ustars")]
  // );

  const tx = await cosmwasmClient.signAndBroadcast(
    userAddresses["stargaze-1"],
    [msg],
    "auto"
  );

  console.log(tx);
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function TokenPage() {
  const router = useRouter();

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

  const { data: amount, fetchStatus } = useGetAmount(
    priceFloat,
    selectedAsset.id,
    selectedAsset.chainID
  );

  const amountInWei = useMemo(() => {
    if (!amount) {
      return "0";
    }

    return ethers.parseUnits(amount.toFixed(6), 6).toString();
  }, [amount]);

  const { chainRecords } = useManager();

  const [txPending, setTxPending] = useState(false);

  const selectedChainRecord = useMemo(() => {
    return chainRecords.find(
      (record) => record.chain.chain_id === selectedAsset.chainID
    );
  }, [chainRecords, selectedAsset.chainID]) as ChainRecord;

  const { status: walletStatus, connect } = useChain(selectedChainRecord.name);

  const { data: swapRoute } = useSwapRoute(
    amountInWei,
    {
      denom: selectedAsset.id,
      chainId: selectedAsset.chainID,
    },
    {
      denom: "ustars",
      chainId: "stargaze-1",
    },
    amountInWei !== "0" && selectedAsset.id !== "ustars"
  );

  console.log(swapRoute);

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
                    <p className="text-xs font-semibold text-zinc-500">
                      on Cosmos Hub
                    </p>
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
                  <p className="font-semibold">{amount && amount.toFixed(6)}</p>
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
                    if (!swapRoute || !token) {
                      return;
                    }

                    setTxPending(true);

                    try {
                      await submit(
                        token.price,
                        collectionAddress,
                        tokenID,
                        swapRoute
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
