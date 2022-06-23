import { FarmPoolKeys } from "@raydium-io/raydium-sdk";
import axios from "axios";

export async function fetchAllFarmPoolKeys() {
    try {
        const response = await axios.get("https://api.raydium.io/v2/sdk/farm/mainnet.json");
        let list: FarmPoolKeys[] = [...(response.data.official ?? [])];
        if (list.length === 0) throw new Error("Error in retrieving farm pool keys");
        return list;
    } catch (error) {
        throw error;
    }
}