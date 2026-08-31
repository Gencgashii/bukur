import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

export default async function getApiKey({ container }: ExecArgs) {
    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const { data } = await query.graph({
        entity: "api_key",
        fields: ["token"],
        filters: { type: "publishable" }
    });
    console.log("PUBLISHABLE_API_KEY_FOUND=" + data[0]?.token);
}
