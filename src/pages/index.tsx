/* eslint-disable @next/next/no-img-element */
import Image from "next/image";
import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatCompact, getCosmWasmStargateClientForChainID } from "@/utils";
import { BAD_KIDS_ADDRESS, MARKETPLACE_ADDRESS } from "@/config/constants";
import { ethers } from "ethers";
import Link from "next/link";
import { Ask } from "@/types";
import axios from "axios";

const formatter = Intl.NumberFormat("en", { notation: "compact" });

interface PageInfo {
  limit: number;
  offset: number;
  total: number;
}

interface Collection {
  id: string;
  name: string;
  description: string;
  media: {
    type: string;
    url: string;
  };
  floorPrice: string;
}

interface CollectionsResult {
  collections: Collection[];
  pageInfo: PageInfo;
}

interface CollectionsResponse {
  collections: CollectionsResult;
}

interface QueryResponse<T> {
  data: T;
}

function useCollectionsQuery() {
  return useQuery({
    queryKey: ["collections"],
    queryFn: async () => {
      const query = /* GraphQL */ `
        query {
          collections(sortBy: VOLUME_24_HOUR_DESC) {
            pageInfo {
              limit
              offset
              total
            }
            collections {
              id
              name
              description
              media {
                type
                url
              }
              floorPrice
            }
          }
        }
      `;

      const response = await axios.post(
        "https://graphql.mainnet.stargaze-apis.com/graphql",
        {
          query,
        }
      );

      const { data } = response.data as QueryResponse<CollectionsResponse>;

      return data.collections;
    },
    refetchInterval: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });
}

function useAskCount(collection: string) {
  return useQuery({
    queryKey: ["askCount", collection],
    queryFn: async () => {
      const client = await getCosmWasmStargateClientForChainID("stargaze-1");

      const response = await client.queryContractSmart(MARKETPLACE_ADDRESS, {
        ask_count: {
          collection,
        },
      });

      return response.count;
    },
    refetchInterval: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });
}

function useAsks(collection: string, startAfter: number = 0) {
  return useQuery({
    queryKey: ["asks", collection, startAfter],
    queryFn: async () => {
      const client = await getCosmWasmStargateClientForChainID("stargaze-1");

      const limit = 30;

      const response = await client.queryContractSmart(MARKETPLACE_ADDRESS, {
        asks: {
          collection,
          start_after: startAfter,
          limit: limit,
        },
      });

      return response.asks as Ask[];
    },
    refetchInterval: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });
}

export default function Home() {
  // const [asks, setAsks] = useState([]);

  const { data: collectionsQueryData } = useCollectionsQuery();

  // useAskCount(BAD_KIDS_ADDRESS);

  // const { data: asks } = useAsks(BAD_KIDS_ADDRESS, 0);

  return (
    <div className="max-w-screen-xl mx-auto p-4 py-8">
      <div className="grid grid-cols-4 gap-6">
        {collectionsQueryData
          ? collectionsQueryData.collections.map((collection, i) => (
              <Link
                key={i}
                className="border border-zinc-700 rounded-lg overflow-hidden"
                href={`/collection/${collection.id}`}
              >
                <img className="w-full" src={collection.media.url} alt="" />
                <div className="px-4 py-4 space-y-1">
                  <p className="font-semibold truncate">{collection.name}</p>
                  <div className="pb-4">
                    <p className="text-sm text-zinc-500 line-clamp-2">
                      {collection.description}
                    </p>
                  </div>
                  <div>
                    <p className="font-bold text-xs text-pink-500 mb-0.5">
                      Floor Price
                    </p>
                    <p className="text-xs">
                      {formatCompact(
                        parseFloat(ethers.formatUnits(collection.floorPrice, 6))
                      )}{" "}
                      STARS
                    </p>
                  </div>
                </div>
              </Link>
            ))
          : Array.from({ length: 20 }).map((_, i) => (
              <div
                className="bg-zinc-800 aspect-[3/4] rounded-lg animate-pulse"
                key={i}
              />
            ))}
      </div>
      {/* <div className="flex gap-4">
        <button className="border border-slate-600 hover:bg-pink-500 hover:border-pink-500 hover:text-white font-semibold text-slate-300 rounded-lg px-4 py-2">
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
        </button>
        {Array.from(Array(6)).map((_, i) => (
          <div key={i}>
            <button className="border border-slate-600 hover:bg-pink-500 hover:border-pink-500 hover:text-white font-semibold text-slate-300 rounded-lg px-4 py-2">
              {i + 1}
            </button>
          </div>
        ))}
        <button className="border border-slate-600 hover:bg-pink-500 hover:border-pink-500 hover:text-white font-semibold text-slate-300 rounded-lg px-4 py-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-5 h-5"
          >
            <path
              fillRule="evenodd"
              d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div> */}
    </div>
  );
}
