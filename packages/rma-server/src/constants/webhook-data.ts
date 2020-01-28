export function getBearerTokenOnTrashWebhookData(
  webhookURL: string,
  webhookApiKey: string,
) {
  return {
    webhook_doctype: 'OAuth Bearer Token',
    webhook_docevent: 'on_trash',
    request_url: webhookURL,
    request_structure: 'Form URL-Encoded',
    doctype: 'Webhook',
    webhook_headers: [
      {
        key: 'Content-Type',
        value: 'application/json',
      },
      {
        key: 'x-frappe-api-key',
        value: webhookApiKey,
      },
    ],
    webhook_data: [
      {
        fieldname: 'client',
        key: 'client',
      },
      {
        fieldname: 'user',
        key: 'user',
      },
      {
        fieldname: 'scopes',
        key: 'scopes',
      },
      {
        fieldname: 'access_token',
        key: 'access_token',
      },
      {
        fieldname: 'name',
        key: 'name',
      },
      {
        fieldname: 'status',
        key: 'status',
      },
      {
        fieldname: 'expires_in',
        key: 'expires_in',
      },
      {
        fieldname: 'refresh_token',
        key: 'refresh_token',
      },
    ],
  };
}

export function getBearerTokenAfterInsertWebhookData(
  webhookURL: string,
  webhookApiKey: string,
) {
  return {
    webhook_doctype: 'OAuth Bearer Token',
    webhook_docevent: 'after_insert',
    request_url: webhookURL,
    request_structure: 'Form URL-Encoded',
    doctype: 'Webhook',
    webhook_headers: [
      {
        key: 'Content-Type',
        value: 'application/json',
      },
      {
        key: 'x-frappe-api-key',
        value: webhookApiKey,
      },
    ],
    webhook_data: [
      {
        fieldname: 'client',
        key: 'client',
      },
      {
        fieldname: 'user',
        key: 'user',
      },
      {
        fieldname: 'scopes',
        key: 'scopes',
      },
      {
        fieldname: 'access_token',
        key: 'access_token',
      },
      {
        fieldname: 'name',
        key: 'name',
      },
      {
        fieldname: 'status',
        key: 'status',
      },
      {
        fieldname: 'expires_in',
        key: 'expires_in',
      },
      {
        fieldname: 'refresh_token',
        key: 'refresh_token',
      },
    ],
  };
}

export function getSupplierAfterInsertWebhookData(
  webhookURL: string,
  webhookApiKey: string,
) {
  return {
    webhook_doctype: 'Supplier',
    webhook_docevent: 'after_insert',
    request_url: webhookURL,
    request_structure: 'Form URL-Encoded',
    webhook_headers: [
      {
        key: 'Content-Type',
        value: 'application/json',
      },
      {
        key: 'x-frappe-api-key',
        value: webhookApiKey,
      },
    ],
    webhook_data: [
      {
        fieldname: 'name',
        key: 'name',
      },
      {
        fieldname: 'owner',
        key: 'owner',
      },
      {
        fieldname: 'supplier_name',
        key: 'supplier_name',
      },
      {
        fieldname: 'country',
        key: 'country',
      },
      {
        fieldname: 'default_bank_account',
        key: 'default_bank_account',
      },
      {
        fieldname: 'tax_id',
        key: 'tax_id',
      },
      {
        fieldname: 'tax_category',
        key: 'tax_category',
      },
      {
        fieldname: 'supplier_type',
        key: 'supplier_type',
      },
      {
        fieldname: 'is_internal_supplier',
        key: 'is_internal_supplier',
      },
      {
        fieldname: 'represents_company',
        key: 'represents_company',
      },
      {
        fieldname: 'pan',
        key: 'pan',
      },
      {
        fieldname: 'disabled',
        key: 'disabled',
      },
      {
        fieldname: 'docstatus',
        key: 'docstatus',
      },
      {
        fieldname: 'gst_category',
        key: 'gst_category',
      },
      {
        fieldname: 'export_type',
        key: 'export_type',
      },
    ],
  };
}

export function getSupplierOnUpdateWebhookData(
  webhookURL: string,
  webhookApiKey: string,
) {
  return {
    webhook_doctype: 'Supplier',
    webhook_docevent: 'on_update',
    request_url: webhookURL,
    request_structure: 'Form URL-Encoded',
    webhook_headers: [
      {
        key: 'Content-Type',
        value: 'application/json',
      },
      {
        key: 'x-frappe-api-key',
        value: webhookApiKey,
      },
    ],
    webhook_data: [
      {
        fieldname: 'name',
        key: 'name',
      },
      {
        fieldname: 'owner',
        key: 'owner',
      },
      {
        fieldname: 'supplier_name',
        key: 'supplier_name',
      },
      {
        fieldname: 'country',
        key: 'country',
      },
      {
        fieldname: 'default_bank_account',
        key: 'default_bank_account',
      },
      {
        fieldname: 'tax_id',
        key: 'tax_id',
      },
      {
        fieldname: 'tax_category',
        key: 'tax_category',
      },
      {
        fieldname: 'supplier_type',
        key: 'supplier_type',
      },
      {
        fieldname: 'is_internal_supplier',
        key: 'is_internal_supplier',
      },
      {
        fieldname: 'represents_company',
        key: 'represents_company',
      },
      {
        fieldname: 'pan',
        key: 'pan',
      },
      {
        fieldname: 'disabled',
        key: 'disabled',
      },
      {
        fieldname: 'docstatus',
        key: 'docstatus',
      },
      {
        fieldname: 'gst_category',
        key: 'gst_category',
      },
      {
        fieldname: 'export_type',
        key: 'export_type',
      },
    ],
  };
}

export function getSupplierOnTrashWebhookData(
  webhookURL: string,
  webhookApiKey: string,
) {
  return {
    webhook_doctype: 'Supplier',
    webhook_docevent: 'on_trash',
    request_url: webhookURL,
    request_structure: 'Form URL-Encoded',
    webhook_headers: [
      {
        key: 'Content-Type',
        value: 'application/json',
      },
      {
        key: 'x-frappe-api-key',
        value: webhookApiKey,
      },
    ],
    webhook_data: [
      {
        fieldname: 'name',
        key: 'name',
      },
      {
        fieldname: 'owner',
        key: 'owner',
      },
      {
        fieldname: 'supplier_name',
        key: 'supplier_name',
      },
      {
        fieldname: 'country',
        key: 'country',
      },
      {
        fieldname: 'default_bank_account',
        key: 'default_bank_account',
      },
      {
        fieldname: 'tax_id',
        key: 'tax_id',
      },
      {
        fieldname: 'tax_category',
        key: 'tax_category',
      },
      {
        fieldname: 'supplier_type',
        key: 'supplier_type',
      },
      {
        fieldname: 'is_internal_supplier',
        key: 'is_internal_supplier',
      },
      {
        fieldname: 'represents_company',
        key: 'represents_company',
      },
      {
        fieldname: 'pan',
        key: 'pan',
      },
      {
        fieldname: 'disabled',
        key: 'disabled',
      },
      {
        fieldname: 'docstatus',
        key: 'docstatus',
      },
      {
        fieldname: 'gst_category',
        key: 'gst_category',
      },
      {
        fieldname: 'export_type',
        key: 'export_type',
      },
    ],
  };
}

export function getCustomerAfterInsertWebhookData(
  webhookURL: string,
  webhookApiKey: string,
) {
  return {
    webhook_doctype: 'Customer',
    webhook_docevent: 'after_insert',
    request_url: webhookURL,
    request_structure: 'Form URL-Encoded',
    webhook_headers: [
      {
        key: 'Content-Type',
        value: 'application/json',
      },
      {
        key: 'x-frappe-api-key',
        value: webhookApiKey,
      },
    ],
    webhook_data: [
      {
        fieldname: 'name',
        key: 'name',
      },
      {
        fieldname: 'owner',
        key: 'owner',
      },
      {
        fieldname: 'territory',
        key: 'territory',
      },
      {
        fieldname: 'customer_group',
        key: 'customer_group',
      },
      {
        fieldname: 'gst_category',
        key: 'gst_category',
      },
      {
        fieldname: 'customer_type',
        key: 'customer_type',
      },
      {
        fieldname: 'customer_name',
        key: 'customer_name',
      },
    ],
  };
}

export function getCustomerOnUpdateWebhookData(
  webhookURL: string,
  webhookApiKey: string,
) {
  return {
    webhook_doctype: 'Customer',
    webhook_docevent: 'on_update',
    request_url: webhookURL,
    request_structure: 'Form URL-Encoded',
    webhook_headers: [
      {
        key: 'Content-Type',
        value: 'application/json',
      },
      {
        key: 'x-frappe-api-key',
        value: webhookApiKey,
      },
    ],
    webhook_data: [
      {
        fieldname: 'name',
        key: 'name',
      },
      {
        fieldname: 'owner',
        key: 'owner',
      },
      {
        fieldname: 'territory',
        key: 'territory',
      },
      {
        fieldname: 'customer_group',
        key: 'customer_group',
      },
      {
        fieldname: 'gst_category',
        key: 'gst_category',
      },
      {
        fieldname: 'customer_type',
        key: 'customer_type',
      },
      {
        fieldname: 'customer_name',
        key: 'customer_name',
      },
    ],
  };
}

export function getCustomerOnTrashWebhookData(
  webhookURL: string,
  webhookApiKey: string,
) {
  return {
    webhook_doctype: 'Customer',
    webhook_docevent: 'on_trash',
    request_url: webhookURL,
    request_structure: 'Form URL-Encoded',
    webhook_headers: [
      {
        key: 'Content-Type',
        value: 'application/json',
      },
      {
        key: 'x-frappe-api-key',
        value: webhookApiKey,
      },
    ],
    webhook_data: [
      {
        fieldname: 'name',
        key: 'name',
      },
      {
        fieldname: 'owner',
        key: 'owner',
      },
      {
        fieldname: 'territory',
        key: 'territory',
      },
      {
        fieldname: 'customer_group',
        key: 'customer_group',
      },
      {
        fieldname: 'gst_category',
        key: 'gst_category',
      },
      {
        fieldname: 'customer_type',
        key: 'customer_type',
      },
      {
        fieldname: 'customer_name',
        key: 'customer_name',
      },
    ],
  };
}

export function getItemAfterInsertWebhookData(
  webhookURL: string,
  webhookApiKey: string,
) {
  return {
    webhook_doctype: 'Item',
    webhook_docevent: 'after_insert',
    request_url: webhookURL,
    request_structure: 'Form URL-Encoded',
    webhook_headers: [
      {
        key: 'Content-Type',
        value: 'application/json',
      },
      {
        key: 'x-frappe-api-key',
        value: webhookApiKey,
      },
    ],
    webhook_data: [
      {
        fieldname: 'name',
        key: 'name',
      },
      {
        fieldname: 'item_code',
        key: 'item_code',
      },
      {
        fieldname: 'item_name',
        key: 'item_name',
      },
      {
        fieldname: 'item_group',
        key: 'item_group',
      },
      {
        fieldname: 'stock_uom',
        key: 'stock_uom',
      },
      {
        fieldname: 'disabled',
        key: 'disabled',
      },
      {
        fieldname: 'docstatus',
        key: 'docstatus',
      },
      {
        fieldname: 'owner',
        key: 'owner',
      },
      {
        fieldname: 'creation',
        key: 'creation',
      },
      {
        fieldname: 'modified',
        key: 'modified',
      },
      {
        fieldname: 'modified_by',
        key: 'modified_by',
      },
      {
        fieldname: 'description',
        key: 'description',
      },
      {
        fieldname: 'shelf_life_in_days',
        key: 'shelf_life_in_days',
      },
      {
        fieldname: 'end_of_life',
        key: 'end_of_life',
      },
      {
        fieldname: 'default_material_request_type',
        key: 'default_material_request_type',
      },
      {
        fieldname: 'has_variants',
        key: 'has_variants',
      },
      {
        fieldname: 'has_serial_no',
        key: 'has_serial_no',
      },
      {
        fieldname: 'is_purchase_item',
        key: 'is_purchase_item',
      },
      {
        fieldname: 'min_order_qty',
        key: 'min_order_qty',
      },
    ],
  };
}

export function getItemOnUpdateWebhookData(
  webhookURL: string,
  webhookApiKey: string,
) {
  return {
    webhook_doctype: 'Item',
    webhook_docevent: 'on_update',
    request_url: webhookURL,
    request_structure: 'Form URL-Encoded',
    webhook_headers: [
      {
        key: 'Content-Type',
        value: 'application/json',
      },
      {
        key: 'x-frappe-api-key',
        value: webhookApiKey,
      },
    ],
    webhook_data: [
      {
        fieldname: 'name',
        key: 'name',
      },
      {
        fieldname: 'item_code',
        key: 'item_code',
      },
      {
        fieldname: 'item_name',
        key: 'item_name',
      },
      {
        fieldname: 'item_group',
        key: 'item_group',
      },
      {
        fieldname: 'stock_uom',
        key: 'stock_uom',
      },
      {
        fieldname: 'disabled',
        key: 'disabled',
      },
      {
        fieldname: 'docstatus',
        key: 'docstatus',
      },
      {
        fieldname: 'owner',
        key: 'owner',
      },
      {
        fieldname: 'creation',
        key: 'creation',
      },
      {
        fieldname: 'modified',
        key: 'modified',
      },
      {
        fieldname: 'modified_by',
        key: 'modified_by',
      },
      {
        fieldname: 'description',
        key: 'description',
      },
      {
        fieldname: 'shelf_life_in_days',
        key: 'shelf_life_in_days',
      },
      {
        fieldname: 'end_of_life',
        key: 'end_of_life',
      },
      {
        fieldname: 'default_material_request_type',
        key: 'default_material_request_type',
      },
      {
        fieldname: 'has_variants',
        key: 'has_variants',
      },
      {
        fieldname: 'has_serial_no',
        key: 'has_serial_no',
      },
      {
        fieldname: 'is_purchase_item',
        key: 'is_purchase_item',
      },
      {
        fieldname: 'min_order_qty',
        key: 'min_order_qty',
      },
    ],
  };
}

export function getItemOnTrashWebhookData(
  webhookURL: string,
  webhookApiKey: string,
) {
  return {
    webhook_doctype: 'Item',
    webhook_docevent: 'on_trash',
    request_url: webhookURL,
    request_structure: 'Form URL-Encoded',
    webhook_headers: [
      {
        key: 'Content-Type',
        value: 'application/json',
      },
      {
        key: 'x-frappe-api-key',
        value: webhookApiKey,
      },
    ],
    webhook_data: [
      {
        fieldname: 'name',
        key: 'name',
      },
      {
        fieldname: 'item_code',
        key: 'item_code',
      },
      {
        fieldname: 'item_name',
        key: 'item_name',
      },
      {
        fieldname: 'item_group',
        key: 'item_group',
      },
      {
        fieldname: 'stock_uom',
        key: 'stock_uom',
      },
      {
        fieldname: 'disabled',
        key: 'disabled',
      },
      {
        fieldname: 'docstatus',
        key: 'docstatus',
      },
      {
        fieldname: 'owner',
        key: 'owner',
      },
      {
        fieldname: 'creation',
        key: 'creation',
      },
      {
        fieldname: 'modified',
        key: 'modified',
      },
      {
        fieldname: 'modified_by',
        key: 'modified_by',
      },
      {
        fieldname: 'description',
        key: 'description',
      },
      {
        fieldname: 'shelf_life_in_days',
        key: 'shelf_life_in_days',
      },
      {
        fieldname: 'end_of_life',
        key: 'end_of_life',
      },
      {
        fieldname: 'default_material_request_type',
        key: 'default_material_request_type',
      },
      {
        fieldname: 'has_variants',
        key: 'has_variants',
      },
      {
        fieldname: 'has_serial_no',
        key: 'has_serial_no',
      },
      {
        fieldname: 'is_purchase_item',
        key: 'is_purchase_item',
      },
      {
        fieldname: 'min_order_qty',
        key: 'min_order_qty',
      },
    ],
  };
}

export function getSerialNoOnTrashWebhookData(
  webhookURL: string,
  webhookApiKey: string,
) {
  return {
    webhook_doctype: 'Serial No',
    webhook_docevent: 'on_trash',
    request_url: webhookURL,
    request_structure: 'Form URL-Encoded',
    webhook_headers: [
      {
        key: 'Content-Type',
        value: 'application/json',
      },
      {
        key: 'x-frappe-api-key',
        value: webhookApiKey,
      },
    ],
    webhook_data: [
      {
        fieldname: 'name',
        key: 'name',
      },
      {
        fieldname: 'owner',
        key: 'owner',
      },

      {
        fieldname: 'creation',
        key: 'creation',
      },
      {
        fieldname: 'modified',
        key: 'modified',
      },
      {
        fieldname: 'modified_by',
        key: 'modified_by',
      },
      {
        fieldname: 'idx',
        key: 'idx',
      },
      {
        fieldname: 'docstatus',
        key: 'docstatus',
      },
      {
        fieldname: 'serial_no',
        key: 'serial_no',
      },
      {
        fieldname: 'item_code',
        key: 'item_code',
      },
      {
        fieldname: 'item_name',
        key: 'item_name',
      },
      {
        fieldname: 'description',
        key: 'description',
      },
      {
        fieldname: 'item_group',
        key: 'item_group',
      },
      {
        fieldname: 'purchase_time',
        key: 'purchase_time',
      },
      {
        fieldname: 'purchase_rate',
        key: 'purchase_rate',
      },
      {
        fieldname: 'supplier',
        key: 'supplier',
      },
      {
        fieldname: 'supplier_name',
        key: 'supplier_name',
      },
      {
        fieldname: 'asset_status',
        key: 'asset_status',
      },
      {
        fieldname: 'delivery_time',
        key: 'delivery_time',
      },
      {
        fieldname: 'is_cancelled',
        key: 'is_cancelled',
      },
      {
        fieldname: 'customer',
        key: 'customer',
      },
      {
        fieldname: 'customer_name',
        key: 'customer_name',
      },
      {
        fieldname: 'warranty_expiry_date',
        key: 'warranty_expiry_date',
      },
      {
        fieldname: 'maintenance_status',
        key: 'maintenance_status',
      },
      {
        fieldname: 'warranty_period',
        key: 'warranty_period',
      },
      {
        fieldname: 'serial_no_details',
        key: 'serial_no_details',
      },
      {
        fieldname: 'company',
        key: 'company',
      },
      {
        fieldname: 'doctype',
        key: 'doctype',
      },
    ],
  };
}

export function getSerialNoUpdateWebhookData(
  webhookURL: string,
  webhookApiKey: string,
) {
  return {
    webhook_doctype: 'Serial No',
    webhook_docevent: 'on_update',
    request_url: webhookURL,
    request_structure: 'Form URL-Encoded',
    webhook_headers: [
      {
        key: 'Content-Type',
        value: 'application/json',
      },
      {
        key: 'x-frappe-api-key',
        value: webhookApiKey,
      },
    ],
    webhook_data: [
      {
        fieldname: 'name',
        key: 'name',
      },
      {
        fieldname: 'owner',
        key: 'owner',
      },

      {
        fieldname: 'creation',
        key: 'creation',
      },
      {
        fieldname: 'modified',
        key: 'modified',
      },
      {
        fieldname: 'modified_by',
        key: 'modified_by',
      },
      {
        fieldname: 'idx',
        key: 'idx',
      },
      {
        fieldname: 'docstatus',
        key: 'docstatus',
      },
      {
        fieldname: 'serial_no',
        key: 'serial_no',
      },
      {
        fieldname: 'item_code',
        key: 'item_code',
      },
      {
        fieldname: 'item_name',
        key: 'item_name',
      },
      {
        fieldname: 'description',
        key: 'description',
      },
      {
        fieldname: 'item_group',
        key: 'item_group',
      },
      {
        fieldname: 'purchase_time',
        key: 'purchase_time',
      },
      {
        fieldname: 'purchase_rate',
        key: 'purchase_rate',
      },
      {
        fieldname: 'supplier',
        key: 'supplier',
      },
      {
        fieldname: 'supplier_name',
        key: 'supplier_name',
      },
      {
        fieldname: 'asset_status',
        key: 'asset_status',
      },
      {
        fieldname: 'delivery_time',
        key: 'delivery_time',
      },
      {
        fieldname: 'is_cancelled',
        key: 'is_cancelled',
      },
      {
        fieldname: 'customer',
        key: 'customer',
      },
      {
        fieldname: 'customer_name',
        key: 'customer_name',
      },
      {
        fieldname: 'warranty_expiry_date',
        key: 'warranty_expiry_date',
      },
      {
        fieldname: 'maintenance_status',
        key: 'maintenance_status',
      },
      {
        fieldname: 'warranty_period',
        key: 'warranty_period',
      },
      {
        fieldname: 'serial_no_details',
        key: 'serial_no_details',
      },
      {
        fieldname: 'company',
        key: 'company',
      },
      {
        fieldname: 'doctype',
        key: 'doctype',
      },
    ],
  };
}

export function getSerialNoAfterInsertWebhookData(
  webhookURL: string,
  webhookApiKey: string,
) {
  return {
    webhook_doctype: 'Serial No',
    webhook_docevent: 'after_insert',
    request_url: webhookURL,
    request_structure: 'Form URL-Encoded',
    webhook_headers: [
      {
        key: 'Content-Type',
        value: 'application/json',
      },
      {
        key: 'x-frappe-api-key',
        value: webhookApiKey,
      },
    ],
    webhook_data: [
      {
        fieldname: 'name',
        key: 'name',
      },
      {
        fieldname: 'owner',
        key: 'owner',
      },

      {
        fieldname: 'creation',
        key: 'creation',
      },
      {
        fieldname: 'modified',
        key: 'modified',
      },
      {
        fieldname: 'modified_by',
        key: 'modified_by',
      },
      {
        fieldname: 'idx',
        key: 'idx',
      },
      {
        fieldname: 'docstatus',
        key: 'docstatus',
      },
      {
        fieldname: 'serial_no',
        key: 'serial_no',
      },
      {
        fieldname: 'item_code',
        key: 'item_code',
      },
      {
        fieldname: 'item_name',
        key: 'item_name',
      },
      {
        fieldname: 'description',
        key: 'description',
      },
      {
        fieldname: 'item_group',
        key: 'item_group',
      },
      {
        fieldname: 'purchase_time',
        key: 'purchase_time',
      },
      {
        fieldname: 'purchase_rate',
        key: 'purchase_rate',
      },
      {
        fieldname: 'supplier',
        key: 'supplier',
      },
      {
        fieldname: 'supplier_name',
        key: 'supplier_name',
      },
      {
        fieldname: 'asset_status',
        key: 'asset_status',
      },
      {
        fieldname: 'delivery_time',
        key: 'delivery_time',
      },
      {
        fieldname: 'is_cancelled',
        key: 'is_cancelled',
      },
      {
        fieldname: 'customer',
        key: 'customer',
      },
      {
        fieldname: 'customer_name',
        key: 'customer_name',
      },
      {
        fieldname: 'warranty_expiry_date',
        key: 'warranty_expiry_date',
      },
      {
        fieldname: 'maintenance_status',
        key: 'maintenance_status',
      },
      {
        fieldname: 'warranty_period',
        key: 'warranty_period',
      },
      {
        fieldname: 'serial_no_details',
        key: 'serial_no_details',
      },
      {
        fieldname: 'company',
        key: 'company',
      },
      {
        fieldname: 'doctype',
        key: 'doctype',
      },
    ],
  };
}

export function deliveryNoteNoAfterInsertWebhookData(
  webhookURL: string,
  webhookApiKey: string,
) {
  return {
    webhook_doctype: 'Delivery Note',
    webhook_docevent: 'after_insert',
    request_url: webhookURL,
    request_structure: 'Form URL-Encoded',
    doctype: 'Webhook',
    webhook_headers: [
      {
        key: 'Content-Type',
        value: 'application/json',
      },
      {
        key: 'x-frappe-api-key',
        value: webhookApiKey,
      },
    ],
    webhook_data: [
      {
        fieldname: 'name',
        key: 'name',
      },
      {
        fieldname: 'modified_by',
        key: 'modified_by',
      },
      {
        fieldname: 'docstatus',
        key: 'docstatus',
      },
      {
        fieldname: 'title',
        key: 'title',
      },
      {
        fieldname: 'naming_series',
        key: 'naming_series',
      },
      {
        fieldname: 'customer',
        key: 'customer',
      },
      {
        fieldname: 'customer_name',
        key: 'customer_name',
      },
      {
        fieldname: 'company',
        key: 'company',
      },
      {
        fieldname: 'posting_date',
        key: 'posting_date',
      },
      {
        fieldname: 'posting_time',
        key: 'posting_time',
      },
      {
        fieldname: 'is_return',
        key: 'is_return',
      },
      {
        fieldname: 'currency',
        key: 'currency',
      },
      {
        fieldname: 'conversion_rate',
        key: 'conversion_rate',
      },
      {
        fieldname: 'total_qty',
        key: 'total_qty',
      },
      {
        fieldname: 'base_total',
        key: 'base_total',
      },
      {
        fieldname: 'base_net_total',
        key: 'base_net_total',
      },
      {
        fieldname: 'total',
        key: 'total',
      },
      {
        fieldname: 'net_total',
        key: 'net_total',
      },
      {
        fieldname: 'base_grand_total',
        key: 'base_grand_total',
      },
      {
        fieldname: 'customer_group',
        key: 'customer_group',
      },
      {
        fieldname: 'territory',
        key: 'territory',
      },
      {
        fieldname: 'items',
        key: 'items',
      },
      {
        fieldname: 'pricing_rules',
        key: 'pricing_rules',
      },
      {
        fieldname: 'packed_items',
        key: 'packed_items',
      },
      {
        fieldname: 'taxes',
        key: 'taxes',
      },
      {
        fieldname: 'sales_team',
        key: 'sales_team',
      },
    ],
  };
}

export function deliveryNoteOnUpdateWebhookData(
  webhookURL: string,
  webhookApiKey: string,
) {
  return {
    webhook_doctype: 'Delivery Note',
    webhook_docevent: 'on_update',
    request_url: webhookURL,
    request_structure: 'Form URL-Encoded',
    doctype: 'Webhook',
    webhook_headers: [
      {
        key: 'Content-Type',
        value: 'application/json',
      },
      {
        key: 'x-frappe-api-key',
        value: webhookApiKey,
      },
    ],
    webhook_data: [
      {
        fieldname: 'name',
        key: 'name',
      },
      {
        fieldname: 'modified_by',
        key: 'modified_by',
      },
      {
        fieldname: 'docstatus',
        key: 'docstatus',
      },
      {
        fieldname: 'title',
        key: 'title',
      },
      {
        fieldname: 'naming_series',
        key: 'naming_series',
      },
      {
        fieldname: 'customer',
        key: 'customer',
      },
      {
        fieldname: 'customer_name',
        key: 'customer_name',
      },
      {
        fieldname: 'company',
        key: 'company',
      },
      {
        fieldname: 'posting_date',
        key: 'posting_date',
      },
      {
        fieldname: 'posting_time',
        key: 'posting_time',
      },
      {
        fieldname: 'is_return',
        key: 'is_return',
      },
      {
        fieldname: 'currency',
        key: 'currency',
      },
      {
        fieldname: 'conversion_rate',
        key: 'conversion_rate',
      },
      {
        fieldname: 'total_qty',
        key: 'total_qty',
      },
      {
        fieldname: 'base_total',
        key: 'base_total',
      },
      {
        fieldname: 'base_net_total',
        key: 'base_net_total',
      },
      {
        fieldname: 'total',
        key: 'total',
      },
      {
        fieldname: 'net_total',
        key: 'net_total',
      },
      {
        fieldname: 'base_grand_total',
        key: 'base_grand_total',
      },
      {
        fieldname: 'customer_group',
        key: 'customer_group',
      },
      {
        fieldname: 'territory',
        key: 'territory',
      },
      {
        fieldname: 'items',
        key: 'items',
      },
      {
        fieldname: 'pricing_rules',
        key: 'pricing_rules',
      },
      {
        fieldname: 'packed_items',
        key: 'packed_items',
      },
      {
        fieldname: 'taxes',
        key: 'taxes',
      },
      {
        fieldname: 'sales_team',
        key: 'sales_team',
      },
    ],
  };
}

export function deliveryNoteOnTrashWebhookData(
  webhookURL: string,
  webhookApiKey: string,
) {
  return {
    webhook_doctype: 'Delivery Note',
    webhook_docevent: 'on_trash',
    request_url: webhookURL,
    request_structure: 'Form URL-Encoded',
    doctype: 'Webhook',
    webhook_headers: [
      {
        key: 'Content-Type',
        value: 'application/json',
      },
      {
        key: 'x-frappe-api-key',
        value: webhookApiKey,
      },
    ],
    webhook_data: [
      {
        fieldname: 'name',
        key: 'name',
      },
      {
        fieldname: 'modified_by',
        key: 'modified_by',
      },
      {
        fieldname: 'docstatus',
        key: 'docstatus',
      },
      {
        fieldname: 'title',
        key: 'title',
      },
      {
        fieldname: 'naming_series',
        key: 'naming_series',
      },
      {
        fieldname: 'customer',
        key: 'customer',
      },
      {
        fieldname: 'customer_name',
        key: 'customer_name',
      },
      {
        fieldname: 'company',
        key: 'company',
      },
      {
        fieldname: 'posting_date',
        key: 'posting_date',
      },
      {
        fieldname: 'posting_time',
        key: 'posting_time',
      },
      {
        fieldname: 'is_return',
        key: 'is_return',
      },
      {
        fieldname: 'currency',
        key: 'currency',
      },
      {
        fieldname: 'conversion_rate',
        key: 'conversion_rate',
      },
      {
        fieldname: 'total_qty',
        key: 'total_qty',
      },
      {
        fieldname: 'base_total',
        key: 'base_total',
      },
      {
        fieldname: 'base_net_total',
        key: 'base_net_total',
      },
      {
        fieldname: 'total',
        key: 'total',
      },
      {
        fieldname: 'net_total',
        key: 'net_total',
      },
      {
        fieldname: 'base_grand_total',
        key: 'base_grand_total',
      },
      {
        fieldname: 'customer_group',
        key: 'customer_group',
      },
      {
        fieldname: 'territory',
        key: 'territory',
      },
      {
        fieldname: 'items',
        key: 'items',
      },
      {
        fieldname: 'pricing_rules',
        key: 'pricing_rules',
      },
      {
        fieldname: 'packed_items',
        key: 'packed_items',
      },
      {
        fieldname: 'taxes',
        key: 'taxes',
      },
      {
        fieldname: 'sales_team',
        key: 'sales_team',
      },
    ],
  };
}

export function purchaseInvoiceOnSubmitWebhookData(
  webhookURL: string,
  webhookApiKey: string,
) {
  return {
    webhook_doctype: 'Purchase Invoice',
    webhook_docevent: 'on_submit',
    request_url: webhookURL,
    request_structure: 'Form URL-Encoded',
    doctype: 'Webhook',
    webhook_headers: [
      {
        key: 'Content-Type',
        value: 'application/json',
      },
      {
        key: 'x-frappe-api-key',
        value: webhookApiKey,
      },
    ],
    webhook_data: [
      {
        fieldname: 'name',
        key: 'name',
      },
      {
        fieldname: 'docstatus',
        key: 'docstatus',
      },
      {
        fieldname: 'title',
        key: 'title',
      },
      {
        fieldname: 'naming_series',
        key: 'naming_series',
      },
      {
        fieldname: 'supplier',
        key: 'supplier',
      },
      {
        fieldname: 'supplier_name',
        key: 'supplier_name',
      },
      {
        fieldname: 'due_date',
        key: 'due_date',
      },
      {
        fieldname: 'is_paid',
        key: 'is_paid',
      },
      {
        fieldname: 'is_return',
        key: 'is_return',
      },
      {
        fieldname: 'company',
        key: 'company',
      },
      {
        fieldname: 'posting_date',
        key: 'posting_date',
      },
      {
        fieldname: 'posting_time',
        key: 'posting_time',
      },
      {
        fieldname: 'supplier_address',
        key: 'supplier_address',
      },
      {
        fieldname: 'address_display',
        key: 'address_display',
      },
      {
        fieldname: 'buying_price_list',
        key: 'buying_price_list',
      },
      {
        fieldname: 'update_stock',
        key: 'update_stock',
      },
      {
        fieldname: 'total_qty',
        key: 'total_qty',
      },
      {
        fieldname: 'base_total',
        key: 'base_total',
      },
      {
        fieldname: 'total',
        key: 'total',
      },
      {
        fieldname: 'in_words',
        key: 'in_words',
      },
      {
        fieldname: 'total_advance',
        key: 'total_advance',
      },
      {
        fieldname: 'outstanding_amount',
        key: 'outstanding_amount',
      },
      {
        fieldname: 'paid_amount',
        key: 'paid_amount',
      },
      {
        fieldname: 'credit_to',
        key: 'credit_to',
      },
      {
        fieldname: 'against_expense_account',
        key: 'against_expense_account',
      },
      {
        fieldname: 'items',
        key: 'items',
      },
      {
        fieldname: 'pricing_rules',
        key: 'pricing_rules',
      },
      {
        fieldname: 'supplied_items',
        key: 'supplied_items',
      },
      {
        fieldname: 'taxes',
        key: 'taxes',
      },
      {
        fieldname: 'advances',
        key: 'advances',
      },
      {
        fieldname: 'payment_schedule',
        key: 'payment_schedule',
      },
    ],
  };
}
