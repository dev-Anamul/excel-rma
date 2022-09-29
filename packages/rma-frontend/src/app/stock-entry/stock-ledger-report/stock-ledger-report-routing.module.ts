import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { StockLedgerReportComponent } from './stock-ledger-report.component';

const routes: Routes = [
  {
    path: '',
    component: StockLedgerReportComponent,
  },
];
@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class StockLedgerReportRoutingModule { }
