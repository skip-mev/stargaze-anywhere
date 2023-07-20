import axios from "axios";

interface Coin {
  price: number;
  symbol: string;
  timestamp: number;
  confidence: number;
}

interface CoinsResponse {
  coins: Record<string, Coin>;
}

export async function getPriceFromDefiLlama(id: string) {
  const response = await axios.get(
    `https://coins.llama.fi/prices/current/coingecko:${id}`
  );

  const { coins } = response.data as CoinsResponse;

  return coins[`coingecko:${id}`].price;
}
