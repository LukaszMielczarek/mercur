import { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework'
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils'
import { createShippingOptionsWorkflow } from '@medusajs/medusa/core-flows'

import { SELLER_MODULE } from '../../../../../modules/seller'
import { fetchSellerByAuthActorId } from '../../../../../shared/infra/http/utils'
import { VendorCreateShippingOptionType } from '../../validators'

/**
 * @oas [post] /vendor/service-zones/{id}/shipping-options
 * operationId: "VendorCreateShippingOption"
 * summary: "Create a Shipping Option"
 * description: "Creates a Shipping Option for a Service Zone."
 * x-authenticated: true
 * parameters:
 *   - in: path
 *     name: id
 *     required: true
 *     description: The ID of the Service Zone.
 *     schema:
 *       type: string
 * requestBody:
 *   content:
 *     application/json:
 *       schema:
 *         $ref: "#/components/schemas/VendorCreateShippingOption"
 * responses:
 *   "201":
 *     description: Created
 *     content:
 *       application/json:
 *         schema:
 *           type: object
 *           properties:
 *             shipping_option:
 *               $ref: "#/components/schemas/VendorShippingOption"
 * tags:
 *   - Shipping Option
 * security:
 *   - api_token: []
 *   - cookie_auth: []
 */
export const POST = async (
  req: AuthenticatedMedusaRequest<VendorCreateShippingOptionType>,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const remoteLink = req.scope.resolve(ContainerRegistrationKeys.REMOTE_LINK)

  const seller = await fetchSellerByAuthActorId(
    req.auth_context?.actor_id,
    req.scope
  )

  const { result } = await createShippingOptionsWorkflow(req.scope).run({
    input: [
      {
        ...req.validatedBody,
        price_type: 'flat',
        service_zone_id: req.params.id
      }
    ]
  })

  // TODO: Move this into createShippingOptionsWorkflow workflow hook
  // Currently createShippingOptionsWorkflow does not support hooks
  await remoteLink.create({
    [SELLER_MODULE]: {
      seller_id: seller.id
    },
    [Modules.FULFILLMENT]: {
      shipping_option_id: result[0].id
    }
  })

  const {
    data: [shippingOption]
  } = await query.graph(
    {
      entity: 'shipping_option',
      fields: req.remoteQueryConfig.fields,
      filters: { id: result[0].id }
    },
    { throwIfKeyNotFound: true }
  )

  res.status(201).json({ shipping_option: shippingOption })
}

/**
 * @oas [get] /vendor/service-zones/{id}/shipping-options
 * operationId: "VendorListShippingOptions"
 * summary: "List Shipping Options"
 * description: "Retrieves a list of Shipping Options for a Service Zone."
 * x-authenticated: true
 * parameters:
 *   - in: path
 *     name: id
 *     required: true
 *     description: The ID of the Service Zone.
 *     schema:
 *       type: string
 * responses:
 *   "200":
 *     description: OK
 *     content:
 *       application/json:
 *         schema:
 *           type: object
 *           properties:
 *             shipping_options:
 *               type: array
 *               items:
 *                 $ref: "#/components/schemas/VendorShippingOption"
 *             count:
 *               type: integer
 *               description: The total number of items available
 *             offset:
 *               type: integer
 *               description: The number of items skipped before these items
 *             limit:
 *               type: integer
 *               description: The number of items per page
 * tags:
 *   - Shipping Option
 * security:
 *   - api_token: []
 *   - cookie_auth: []
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: shippingOptions, metadata } = await query.graph({
    entity: 'shipping_option',
    fields: req.remoteQueryConfig.fields,
    filters: {
      service_zone_id: req.params.id,
      ...req.filterableFields
    },
    pagination: req.remoteQueryConfig.pagination
  })

  res.json({
    shipping_options: shippingOptions,
    count: metadata!.count,
    offset: metadata!.skip,
    limit: metadata!.take
  })
}
