import {
  CosmWasmClient,
  SigningCosmWasmClient,
  SigningCosmWasmClientOptions,
} from "@cosmjs/cosmwasm-stargate";
import { OfflineSigner } from "@cosmjs/proto-signing";
import {
  SigningStargateClient,
  SigningStargateClientOptions,
  StargateClient,
} from "@cosmjs/stargate";
import chainRegistry from "chain-registry";

const CLIENTS: Record<string, CosmWasmClient> = {};

export async function getCosmWasmStargateClientForChainID(chainID: string) {
  if (CLIENTS[chainID]) {
    return CLIENTS[chainID];
  }

  const client = await CosmWasmClient.connect(
    `https://ibc.fun/nodes/${chainID}`
  );

  CLIENTS[chainID] = client;

  return client;
}

export async function getSigningCosmWasmClient(
  chainID: string,
  signer: OfflineSigner,
  options?: SigningCosmWasmClientOptions
) {
  const client = await SigningCosmWasmClient.connectWithSigner(
    `https://ibc.fun/nodes/${chainID}`,
    signer,
    options
  );

  return client;
}

// cache clients to reuse later
const STARGATE_CLIENTS: Record<string, StargateClient> = {};

export async function getStargateClientForChainID(chainID: string) {
  if (STARGATE_CLIENTS[chainID]) {
    return STARGATE_CLIENTS[chainID];
  }

  const chain = chainRegistry.chains.find(
    (chain) => chain.chain_id === chainID
  );

  if (!chain) {
    throw new Error(`Chain with ID ${chainID} not found`);
  }

  const preferredEndpoint = `https://ibc.fun/nodes/${chainID}`;

  const client = await StargateClient.connect(preferredEndpoint, {});

  STARGATE_CLIENTS[chainID] = client;

  return client;
}

export async function getSigningStargateClientForChainID(
  chainID: string,
  signer: OfflineSigner,
  options?: SigningStargateClientOptions
) {
  const preferredEndpoint = `https://ibc.fun/nodes/${chainID}`;

  const client = await SigningStargateClient.connectWithSigner(
    preferredEndpoint,
    signer,
    options
  );

  console.log(`Connected to ${preferredEndpoint}`);

  return client;
}

export function formatCompact(n: number) {
  const formatter = Intl.NumberFormat("en", { notation: "compact" });

  return formatter.format(n);
}

export async function getAddressForChain(chainId: string) {
  if (!window.keplr) {
    throw new Error("Keplr extension is not installed");
  }

  const signer = window.keplr.getOfflineSigner(chainId);
  const accounts = await signer.getAccounts();

  return accounts[0].address;
}

export function getChainByID(chainID: string) {
  return chainRegistry.chains.find(
    (chain) => chain.chain_id === chainID
  ) as (typeof chainRegistry.chains)[0];
}
