import { Component, OnInit, ViewChild } from '@angular/core';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';

import { WarrantyClaimsDataSource } from './warranty-claims-datasource';
import { Location } from '@angular/common';

@Component({
  selector: 'app-warranty',
  templateUrl: './warranty.page.html',
  styleUrls: ['./warranty.page.scss'],
})
export class WarrantyPage implements OnInit {
  @ViewChild(MatPaginator, { static: true }) paginator: MatPaginator;
  @ViewChild(MatSort, { static: true }) sort: MatSort;

  dataSource: WarrantyClaimsDataSource;
  displayedColumns = [
    'claim_no',
    'claim_type',
    'received_date',
    'deliver_date',
    'customer_third_party',
    'item',
    'claimed_serial',
    'service_charge',
    'claim_status',
    'warranty_status',
    'receiving_branch',
    'delivery_branch',
    'received_by',
    'delivered_by',
    'invoice_no',
  ];
  customer: string;
  claimNo: string;
  thirdParty: string;
  product: string;
  fromDate: string;
  claimStatus: string;
  claimType: string;
  territory: string;
  serial: string;
  toDate: string;

  constructor(private location: Location) {}

  ngOnInit() {
    this.dataSource = new WarrantyClaimsDataSource();

    this.dataSource.loadItems();
  }
  getUpdate(event) {
    const query: any = {};

    this.dataSource.loadItems(
      undefined,
      event.pageIndex,
      event.pageSize,
      query,
    );
  }

  setFilter(event?) {
    const query: any = {};
    if (this.customer) query.customer = this.customer;
    if (this.claimNo) query.claimNo = this.claimNo;
    if (this.thirdParty) query.thirdParty = this.thirdParty;
    if (this.product) query.product = this.product;
    if (this.fromDate) query.fromDate = this.fromDate;
    if (this.claimStatus) query.claimStatus = this.claimStatus;
    if (this.claimType) query.claimType = this.claimType;
    if (this.territory) query.territory = this.territory;
    if (this.serial) query.serial = this.serial;
    if (this.toDate) query.toDate = this.toDate;

    const sortQuery = {};
    if (event) {
      for (const key of Object.keys(event)) {
        if (key === 'active') {
          sortQuery[event[key]] = event.direction;
        }
      }
    }

    this.dataSource.loadItems(
      sortQuery,
      this.paginator.pageIndex,
      this.paginator.pageSize,
      query,
    );
  }

  navigateBack() {
    this.location.back();
  }
}