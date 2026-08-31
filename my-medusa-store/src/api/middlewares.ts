import { defineMiddlewares } from "@medusajs/medusa"

export default defineMiddlewares({
    routes: [
        {
            matcher: "/admin/uploads",
            bodyParser: {
                sizeLimit: "15mb",
            },
        },
    ],
})
