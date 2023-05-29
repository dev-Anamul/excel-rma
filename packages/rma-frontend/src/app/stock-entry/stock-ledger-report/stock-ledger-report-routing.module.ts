import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { StockLedgerReportPage } from './stock-ledger-report.page';

const routes: Routes = [
  {
    path: '',
    component: StockLedgerReportPage,
  },
];
@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class StockLedgerReportRoutingModule {}
