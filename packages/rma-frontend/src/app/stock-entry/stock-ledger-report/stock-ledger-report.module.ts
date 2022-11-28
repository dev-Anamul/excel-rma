import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { StockLedgerReportRoutingModule } from './stock-ledger-report-routing.module';

import { StockLedgerReportComponent } from './stock-ledger-report.component';
import { MaterialModule } from '../../material/material.module';
import { AppCommonModule } from '../../common/app-common.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    StockLedgerReportRoutingModule,
    AppCommonModule,
    MaterialModule,
    ReactiveFormsModule,
  ],
  declarations: [StockLedgerReportComponent],
})
export class StockLedgerReportModule {}
