import axios from 'axios';

import {
  FarmPoolJsonInfoV1,
  FarmPoolKeys,
} from '@raydium-io/raydium-sdk';
import { PublicKey } from '@solana/web3.js';

export interface CustomFarmPoolJsonInfo extends FarmPoolJsonInfoV1 {
  readonly upcoming: boolean;
}

export async function fetchAllFarmPoolKeys() {
  try {
    const response = await axios.get(
      "https://api.raydium.io/v2/sdk/farm/mainnet.json"
    );
    let list: CustomFarmPoolJsonInfo[] = [...(response.data.official ?? [])];
    if (list.length === 0)
      throw new Error("Error in retrieving farm pool keys");
    let farmPoolKeysList: FarmPoolKeys[] = list.map(
      ({
        id,
        lpMint,
        rewardMints,
        version,
        programId,
        authority,
        lpVault,
        rewardVaults,
        upcoming,
      }) => {
        const temp = rewardMints.map((key, i) => {
          return {
            rewardMint: new PublicKey(key),
            rewardVault: new PublicKey(rewardVaults[i]),
          };
        });
        return {
          id: new PublicKey(id),
          lpMint: new PublicKey(lpMint),
          version: version,
          programId: new PublicKey(programId),
          authority: new PublicKey(authority),
          lpVault: new PublicKey(lpVault),
          upcoming: upcoming,
          rewardInfos: temp,
        };
      }
    );
    return farmPoolKeysList;
  } catch (error) {
    throw error;
  }
}
