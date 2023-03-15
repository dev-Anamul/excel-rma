import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { SerialQuantityPage } from './serial-quantity.page';

const routes: Routes = [
  {
    path: '',
    component: SerialQuantityPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class SerialQuantityPageRoutingModule {}
