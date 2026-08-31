import {
    type SubscriberArgs,
    type SubscriberConfig,
} from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import { createProductOptionsWorkflow, createProductVariantsWorkflow } from "@medusajs/medusa/core-flows"

export default async function productCreateHandler({
    event: { data },
    container,
}: SubscriberArgs<{ id: string }>) {
    const productId = data.id

    const productModuleService = container.resolve(Modules.PRODUCT)

    // Retrieve the newly created product
    const product = await productModuleService.retrieveProduct(productId, {
        relations: ["options", "variants"],
    })

    // Only proceed if the product has no variants and no options
    if ((product.variants && product.variants.length > 0) || (product.options && product.options.length > 0)) {
        return
    }

    console.log(`[Auto-Default] Generating default option and variant for product ${product.id}`)

    try {
        // 1. Create a Default Option
        await createProductOptionsWorkflow(container).run({
            input: {
                options: [
                    {
                        product_id: product.id,
                        title: "Default option",
                    }
                ]
            }
        })

        // 2. Create a Default Variant
        await createProductVariantsWorkflow(container).run({
            input: {
                product_variants: [
                    {
                        product_id: product.id,
                        title: "Default variant",
                        options: {
                            "Default option": "Default option value" // v2 maps the option title to the value
                        }
                    }
                ]
            }
        })

        console.log(`[Auto-Default] Successfully created variant for ${product.id}`)
    } catch (err) {
        console.error(`[Auto-Default] Error creating default variant:`, err)
    }
}

export const config: SubscriberConfig = {
    event: "product.created",
}
