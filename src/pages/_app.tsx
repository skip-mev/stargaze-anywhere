import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { Inter } from "next/font/google";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/query";
import { ChakraProvider } from "@chakra-ui/react";
import { ChainProvider, defaultTheme } from "@cosmos-kit/react";
import { chains, assets } from "chain-registry";
import { wallets } from "@cosmos-kit/keplr";

const inter = Inter({ subsets: ["latin"] });

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ChakraProvider theme={defaultTheme}>
      <ChainProvider
        chains={chains} // supported chains
        assetLists={assets} // supported asset lists
        wallets={wallets} // supported wallets
        wrappedWithChakra={true}
      >
        <QueryClientProvider client={queryClient}>
          <div className={inter.className}>
            <Component {...pageProps} />
            <div className="max-w-screen-xl mx-auto p-4 py-8">
              <p className="text-center">
                Data Provided By:{" "}
                <a
                  className="text-pink-500 hover:underline"
                  href="https://graphql.mainnet.stargaze-apis.com/graphql"
                >
                  https://graphql.mainnet.stargaze-apis.com/graphql
                </a>
              </p>
            </div>
          </div>
        </QueryClientProvider>
      </ChainProvider>
    </ChakraProvider>
  );
}
