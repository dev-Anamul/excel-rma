import { AddWarrantyClaimCommandHandler } from './add-warranty-claim/add-warranty-claim.handler';
import { RemoveWarrantyClaimCommandHandler } from './remove-warranty-claim/remove-warranty-claim.handler';
import { UpdateWarrantyClaimCommandHandler } from './update-warranty-claim/update-warranty-claim.handler';
import { CreateBulkClaimsHandler } from './create-bulk-claims/create-bulk-claims.handler';

export const WarrantyClaimCommandManager = [
  AddWarrantyClaimCommandHandler,
  RemoveWarrantyClaimCommandHandler,
  UpdateWarrantyClaimCommandHandler,
  CreateBulkClaimsHandler,
];