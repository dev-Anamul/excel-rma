import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { SerialInfoPageRoutingModule } from './serial-info-routing.module';

import { SerialInfoPage } from './serial-info.page';
import { MaterialModule } from '../../material/material.module';
import { KeyDownDetectorDirective } from '../../warranty-ui/shared-warranty-modules/service-invoices/add-service-invoice/on-key-down-directive';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    MaterialModule,
    IonicModule,
    SerialInfoPageRoutingModule,
    ReactiveFormsModule,
  ],
  declarations: [SerialInfoPage, KeyDownDetectorDirective],
})
export class SerialInfoPageModule {}
