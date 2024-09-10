import express, { Request, Response } from "express";
import axios from "axios";
import { EAS_CHAIN_CONFIGS } from "./chains";
import { ethers } from "ethers";
import { setGlobalCache, getGlobalCache } from "./cache";

const app = express();
const port = 3008;

// Route for /countAttestations/{chainId}/{address}
app.get(
  "/countAttestations/:chainId/:address",
  async (req: Request, res: Response) => {
    const { chainId, address } = req.params;

    // Create a unique cache key for this request
    const cacheKey = `attestations_${chainId}_${address.toLowerCase()}`;

    // Check if the result is in cache
    const cachedResult = getGlobalCache<{ count: number }>(cacheKey);
    if (cachedResult) {
      return res.json(cachedResult);
    }

    // Find the matching chain config
    const chainConfig = EAS_CHAIN_CONFIGS.find((chain) => chain.id === chainId);

    if (!chainConfig) {
      return res.status(400).json({ error: "Invalid chainId" });
    }

    const url = `https://${chainConfig.subdomain}easscan.org/graphql`;

    try {
      const response = await axios.post(
        url,
        {
          query: `
        query AggregateAttestation($where: AttestationWhereInput) {
          aggregateAttestation(where: $where) {
            _count {
              _all
            }
          }
        }
      `,
          variables: {
            where: {
              OR: [
                { attester: { equals: ethers.getAddress(address) } },
                { recipient: { equals: ethers.getAddress(address) } },
              ],
            },
          },
        },
        {
          headers: { "Content-Type": "application/json" },
        }
      );

      const count = response.data.data.aggregateAttestation._count._all;
      const result = { count };

      // Cache the result for 1 minute (60000 milliseconds)
      setGlobalCache(cacheKey, result, 60000);

      res.json(result);
    } catch (error) {
      console.error("Error fetching attestation count:", error);
      res.status(500).json({ error: "Failed to fetch attestation count" });
    }
  }
);

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
