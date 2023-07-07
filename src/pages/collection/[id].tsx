/* eslint-disable @next/next/no-img-element */
import { useCollection, useTokens } from "@/stargaze/graphql";
import { formatCompact } from "@/utils";
import { ethers } from "ethers";
import Link from "next/link";
import { useRouter } from "next/router";

function CollectionPage() {
  const router = useRouter();

  const collectionAddress = router.query.id as string;

  const { data: collection } = useCollection(collectionAddress);

  const { data: tokensQueryResponse } = useTokens(collectionAddress);

  if (!collection || !tokensQueryResponse) {
    return null;
  }

  return (
    <div className="max-w-screen-xl mx-auto p-4 py-8">
      <div className="space-y-10">
        <div className="flex items-center gap-6">
          <div>
            <img alt="" className="w-32" src={collection.media.url} />
          </div>
          <div>
            <p className="font-semibold text-xl mb-1">{collection.name}</p>
            <p className="text-sm mb-1">
              <span className="font-semibold">Created By:</span>{" "}
              <a className="text-pink-500 hover:underline" href="#">
                {collection.creator.address.slice(0, 8)}...
                {collection.creator.address.slice(-4)}
              </a>
            </p>
            <p className="text-sm text-zinc-500 max-w-prose">
              {collection.description}
            </p>
          </div>
        </div>
        <hr className="border-zinc-700" />
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">
            {collection.tokenCounts.listed} For Sale
          </p>
          <div className="flex items-center gap-4">
            <p className="font-semibold text-sm text-zinc-500">Sort By</p>
            <button className="text-xs font-semibold border border-zinc-600 p-4 py-2 pr-2 rounded-lg inline-flex items-center gap-2">
              <span>Lowest Price</span>
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
            </button>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-6">
          {tokensQueryResponse.tokens.map((token) => (
            <Link
              href={`/token/${token.id}`}
              className="border border-zinc-700 rounded-lg overflow-hidden"
              key={token.id}
            >
              <img alt="" className="w-full" src={token.media.url} />
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-sm">{token.name}</p>
                  <div className="flex items-center gap-1">
                    <p className="text-zinc-500">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="w-3 h-3"
                      >
                        <path d="M15.5 2A1.5 1.5 0 0014 3.5v13a1.5 1.5 0 001.5 1.5h1a1.5 1.5 0 001.5-1.5v-13A1.5 1.5 0 0016.5 2h-1zM9.5 6A1.5 1.5 0 008 7.5v9A1.5 1.5 0 009.5 18h1a1.5 1.5 0 001.5-1.5v-9A1.5 1.5 0 0010.5 6h-1zM3.5 10A1.5 1.5 0 002 11.5v5A1.5 1.5 0 003.5 18h1A1.5 1.5 0 006 16.5v-5A1.5 1.5 0 004.5 10h-1z" />
                      </svg>
                    </p>
                    <p className="text-xs font-semibold">{token.rarityOrder}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-sm">
                    <p className="font-semibold text-zinc-500">Owned By</p>
                    <p className="text-pink-500">
                      {token.owner.slice(0, 8)}...
                      {token.owner.slice(-4)}
                    </p>
                  </div>
                  <div className="text-sm text-right">
                    <p className="font-semibold text-zinc-500">Price</p>
                    <p className="font-semibold">
                      {formatCompact(
                        parseFloat(ethers.formatUnits(token.price, 6))
                      )}{" "}
                      STARS
                    </p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export default CollectionPage;
