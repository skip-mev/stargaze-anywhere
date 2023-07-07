/* eslint-disable @next/next/no-img-element */
import { BAD_KIDS_ADDRESS, MARKETPLACE_ADDRESS } from "@/config/constants";
import { getSwapRoute } from "@/solve/api";
import { Ask } from "@/types";
import { formatCompact, getCosmWasmStargateClientForChainID } from "@/utils";
import { useQuery } from "@tanstack/react-query";
import { ethers } from "ethers";
import { useRouter } from "next/router";
import { useState } from "react";

function useAsk(collection: string, tokenID: number) {
  return useQuery({
    queryKey: ["ask", collection, tokenID],
    queryFn: async () => {
      const client = await getCosmWasmStargateClientForChainID("stargaze-1");

      const response = await client.queryContractSmart(MARKETPLACE_ADDRESS, {
        ask: {
          collection,
          token_id: tokenID,
        },
      });

      return response.ask as Ask;
    },
    refetchInterval: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });
}

function useGetAmount() {
  return useQuery({
    queryKey: ["get-amount"],
    queryFn: async () => {
      let low = 0.000001;
      let high = 9999999.999999;

      const target = 80000.0;

      // let low = 0;
      // let high = targetAmountOut;
      let mid;

      while (low <= high) {
        mid = (low + high) / 2;

        const amountIn = ethers.parseUnits(mid.toFixed(6), 6).toString();

        const response = await getSwapRoute({
          amountIn,
          sourceAsset: {
            denom: "uosmo",
            chainId: "osmosis-1",
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
            denom: "uosmo",
            chainId: "osmosis-1",
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

      console.log(amountInFloat);

      return [];
    },
    refetchInterval: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });
}

function AskPage() {
  const [denomIn, setDenomIn] = useState("uosmo");

  // console.log(denomIn);

  const router = useRouter();

  const tokenID = parseInt(router.query.id as string);

  const { data: ask } = useAsk(BAD_KIDS_ADDRESS, tokenID);

  // console.log(ask);

  // useGetAmount();

  if (!ask) {
    return null;
  }

  return (
    <div className="max-w-screen-lg mx-auto p-4">
      <div className="space-y-2 py-8">
        <a
          href="#"
          className="flex items-center gap-2 text-sm font-bold text-pink-400 hover:underline"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-5 h-5"
          >
            <path
              fillRule="evenodd"
              d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z"
              clipRule="evenodd"
            />
          </svg>

          <span>Back to Collection</span>
        </a>
        <p className="text-2xl font-semibold">Bad Kid #{ask.token_id}</p>
      </div>
      <div className="grid grid-cols-2 items-center">
        <div>
          <img
            alt=""
            className="rounded-xl"
            src={`https://ipfs-gw.stargaze-apis.com/ipfs/QmbGvE3wmxex8KiBbbvMjR8f9adR28s3XkiZSTuGmHoMHV/${ask.token_id}.jpg`}
          />
        </div>
        <div className="p-6">
          <p className="text-pink-400 font-semibold">Price:</p>
          <p className="text-3xl font-semibold">
            {formatCompact(parseFloat(ethers.formatUnits(ask.price, 6)))} STARS
          </p>
          <select
            className="bg-slate-300 text-slate-800"
            name="denom_in"
            id="denom_in"
            onChange={(e) => {
              setDenomIn(e.target.value);
            }}
          >
            <option value="uosmo">OSMO - Osmosis</option>
            <option value="uatom">ATOM - Cosmos</option>
            <option value="uluna">LUNA - Terra</option>
            <option value="uusdc">axlUSDC - Axelar</option>
          </select>
        </div>
      </div>
    </div>
  );
}

export default AskPage;

// if (amountOut > target) {
//   high = mid;
// } else {
//   low = mid + 0.01;
// }
