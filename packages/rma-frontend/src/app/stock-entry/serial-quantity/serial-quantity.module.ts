import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { SerialQuantityPageRoutingModule } from './serial-quantity-routing.module';

import { SerialQuantityPage } from './serial-quantity.page';
import { MaterialModule } from '../../material/material.module';
import { AppCommonModule } from '../../common/app-common.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    SerialQuantityPageRoutingModule,
    AppCommonModule,
    MaterialModule,
    ReactiveFormsModule,
  ],
  declarations: [SerialQuantityPage],
})
export class SerialQuantityPageModule {}
