import express, { Request, Response } from "express";
import axios from "axios";
import { EAS_CHAIN_CONFIGS } from "./chains";
import { ethers } from "ethers";

const app = express();
const port = 3000;

// Route for /countAttestations/{chainId}/{address}
app.get(
  "/countAttestations/:chainId/:address",
  async (req: Request, res: Response) => {
    const { chainId, address } = req.params;

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
      res.json({ count });
    } catch (error) {
      console.error("Error fetching attestation count:", error);
      res.status(500).json({ error: "Failed to fetch attestation count" });
    }
  }
);

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
