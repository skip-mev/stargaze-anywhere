import { useQuery } from "@tanstack/react-query";
import axios from "axios";

interface QueryResponse<T> {
  data: T;
}

interface Collection {
  id: string;
  name: string;
  description: string;
  media: Media;
  floorPrice: string;
  creator: WalletAccount;
  tokenCounts: CollectionTokenCounts;
}

interface CollectionTokenCounts {
  listed: number;
  total: number;
}

interface Media {
  format: string;
  type: string;
  url: string;
}

interface Token {
  id: string;
  name: string;
  owner: string;
  rarityOrder: number;
  price: string;
  media: Media;
}

interface WalletAccount {
  id: string;
  address: string;
}

export interface CollectionQueryResponse {
  collection: Collection;
}

export function useCollection(collectionID: string) {
  return useQuery({
    queryKey: ["collection", collectionID],
    queryFn: async () => {
      const query = /* GraphQL */ `
        query Collection($address: String!) {
          collection(address: $address) {
            id
            name
            description
            media {
              type
              url
            }
            floorPrice
            creator {
              id
              address
            }
            tokenCounts {
              listed
              total
            }
          }
        }
      `;

      const response = await axios.post(
        "https://graphql.mainnet.stargaze-apis.com/graphql",
        {
          query,
          variables: {
            address: collectionID,
          },
        }
      );

      const { data } = response.data as QueryResponse<CollectionQueryResponse>;

      return data.collection;
    },
    refetchInterval: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
    enabled: !!collectionID,
  });
}

interface TokensResult {
  tokens: Token[];
}

export interface TokensQueryResponse {
  tokens: TokensResult;
}

export function useTokens(collectionID: string) {
  return useQuery({
    queryKey: ["tokens", collectionID],
    queryFn: async () => {
      const query = /* GraphQL */ `
        query TokensQuery($collectionAddr: String) {
          tokens(
            collectionAddr: $collectionAddr
            filterForSale: LISTED
            sortBy: PRICE_ASC
          ) {
            pageInfo {
              total
            }
            tokens {
              id
              name
              owner
              price
              rarityOrder
              media {
                type
                url
                format
              }
            }
          }
        }
      `;

      const response = await axios.post(
        "https://graphql.mainnet.stargaze-apis.com/graphql",
        {
          query,
          variables: {
            collectionAddr: collectionID,
          },
        }
      );

      const { data } = response.data as QueryResponse<TokensQueryResponse>;

      return data.tokens;
    },
    refetchInterval: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
    enabled: !!collectionID,
  });
}

export interface TokenQueryResponse {
  token: Token;
}

export function useToken(collectionAddress: string, tokenID: string) {
  return useQuery({
    queryKey: ["token", collectionAddress, tokenID],
    queryFn: async () => {
      const query = /* GraphQL */ `
        query Token($collectionAddress: String!, $id: String!) {
          token(collectionAddr: $collectionAddress, tokenId: $id) {
            id
            name
            owner
            price
            rarityOrder
            media {
              type
              url
              format
            }
          }
        }
      `;

      const response = await axios.post(
        "https://graphql.mainnet.stargaze-apis.com/graphql",
        {
          query,
          variables: {
            collectionAddress,
            id: tokenID,
          },
        }
      );

      const { data } = response.data as QueryResponse<TokenQueryResponse>;

      return data.token;
    },
    refetchInterval: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
    enabled: !!tokenID && !!collectionAddress,
  });
}
