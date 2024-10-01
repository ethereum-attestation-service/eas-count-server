import express, { Request, Response } from "express";
import axios from "axios";
import cors from "cors";
import { EAS_CHAIN_CONFIGS } from "./chains";
import { ethers } from "ethers";
import { setGlobalCache, getGlobalCache } from "./cache";

const app = express();
const port = 3008;

// Enable CORS for all routes
app.use(cors());

// Helper function to get attestation count
async function getAttestationCount(
  chainId: string,
  address: string
): Promise<number> {
  const cacheKey = `attestations_${chainId}_${address.toLowerCase()}`;
  const cachedResult = getGlobalCache<{ count: number }>(cacheKey);
  if (cachedResult) {
    console.log("Cache hit for", cacheKey);
    return cachedResult.count;
  }

  const chainConfig = EAS_CHAIN_CONFIGS.find((chain) => chain.id === chainId);

  if (!chainConfig) {
    throw new Error("Invalid chainId");
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

    // Cache the result for 1 hour (3600000 milliseconds)
    setGlobalCache(cacheKey, result, 3600 * 1000);

    return count;
  } catch (error) {
    console.error(
      `Error fetching attestation count for chain ${chainId}:`,
      error
    );
    return 0;
  }
}

// Helper function to validate Ethereum address
function isValidEthereumAddress(address: string): boolean {
  try {
    ethers.getAddress(address);
    return true;
  } catch (error) {
    return false;
  }
}

// Update /countAttestations endpoint
app.get(
  "/countAttestations/:chainId/:address",
  async (req: Request, res: Response) => {
    const { chainId, address } = req.params;

    if (!isValidEthereumAddress(address)) {
      return res.status(400).json({ error: "Invalid Ethereum address" });
    }

    try {
      const count = await getAttestationCount(chainId, address);
      res.json({ count });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(400).json({ error: "An unknown error occurred" });
      }
    }
  }
);

// Update /countAllAttestations/:address endpoint
app.get(
  "/countAllAttestations/:address",
  async (req: Request, res: Response) => {
    const { address } = req.params;

    if (!address) {
      return res.status(400).json({ error: "Address is required" });
    }

    if (!isValidEthereumAddress(address)) {
      return res.status(400).json({ error: "Invalid Ethereum address" });
    }

    const formattedAddress = ethers.getAddress(address);

    const counts = await Promise.all(
      EAS_CHAIN_CONFIGS.map(async (chain) => {
        const count = await getAttestationCount(chain.id, formattedAddress);
        return { chainId: chain.id, count };
      })
    );

    const totalCount = counts.reduce((sum, item) => sum + item.count, 0);

    res.json({ counts, totalCount });
  }
);

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
