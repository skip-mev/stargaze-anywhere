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
          </div>
        </QueryClientProvider>
      </ChainProvider>
    </ChakraProvider>
  );
}
