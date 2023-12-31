import { DELIVERED_SERIALS_BY } from './app-string';

export const CLIENT_ID = 'client_id';
export const REDIRECT_URI = 'redirect_uri';
export const SILENT_REFRESH_REDIRECT_URI = 'silent_refresh_redirect_uri';
export const LOGIN_URL = 'login_url';
export const ISSUER_URL = 'issuer_url';
export const APP_URL = 'app_url';
export const USER_UUID = 'user_uuid';
export const SERVICES = 'services';
export const STORAGE = 'storage';
export const ACCESS_TOKEN = 'access_token';
export const COMMUNICATION = 'communication';
export const COMMUNICATION_SERVER = 'communication-server';
export const INFRASTRUCTURE_CONSOLE = 'infrastructure-console';
export const IDENTITY_PROVIDER = 'identity-provider';
export const COMMUNICATION_SERVER_URL = 'communication-server-url';
export const LOGGED_IN = 'logged_in';
export const SCOPE = 'scope';
export const SCOPES_OPENID_ALL = 'openid all';
export const AUTH_SERVER_URL = 'auth_server_url';
export const TOKEN = 'token';
export const ACCESS_TOKEN_EXPIRY = 'access_token_expiry';
export const CALLBACK_ENDPOINT = '/callback';
export const SILENT_REFRESH_ENDPOINT = '/silent-refresh.html';
export const STATE = 'state';
export const EXPIRES_IN = 'expires_in';
export const TEN_MINUTES_IN_MS = 600000;
export const TWENTY_MINUTES_IN_SECONDS = 1200;
export const SERIAL_NO = 'serial_no';
export const AUTHORIZATION = 'Authorization';
export const WARRANTY_CLAIM = 'warranty-claim';
export const BEARER_TOKEN_PREFIX = 'Bearer ';
export const DEFAULT_COMPANY = 'defaultCompany';
export const SERVICE_NAME = 'excel-rma';
export const DEFAULT_CURRENCY = 'BDT';
export const DEFAULT_CURRENCY_KEY = 'defaultCurrency';
export const COUNTRY = 'country';
export const TIME_ZONE = 'time_zone';
export const TRANSFER_WAREHOUSE = 'transferWarehouse';
export const DEFAULT_SELLING_PRICE_LIST = 'default_selling_price_list';
export const VALIDATE_SERIAL_BUFFER_COUNT = 50000;
export const ALL_TERRITORIES = 'All Territories';
export const WARRANTY_APP_URL = 'warranty_app_url';
export const POS_PROFILE = 'pos_profile';
export const HUNDRED_NUMBER_STRING = 100;
export const PRINT_FORMAT_PREFIX = 'Excel ';
export const DELIVERED_SERIALS_DISPLAYED_COLUMNS = {
  [DELIVERED_SERIALS_BY.purchase_invoice_name]: [
    'sr_no',
    'serial_no',
    'item_name',
    'warehouse',
    'purchaseWarrantyDate',
    'purchasedOn',
  ],
  [DELIVERED_SERIALS_BY.sales_invoice_name]: [
    'sr_no',
    'serial_no',
    'item_name',
    'warehouse',
    'salesWarrantyDate',
    'soldOn',
  ],
};
export const BASIC_RATE = 'basic_rate';
export const BRAND = 'brand';
export const BACKDATE_PERMISSION = 'backdated_permissions';
export const UPDATE_SALES_INVOICE_STOCK = 'update_sales_invoice_stock';
export const UPDATE_PURCHASE_INVOICE_STOCK = 'update_purchase_invoice_stock';
export const BACKDATE_PERMISSION_FOR_DAYS = 'backdated_permissions_for_days';
