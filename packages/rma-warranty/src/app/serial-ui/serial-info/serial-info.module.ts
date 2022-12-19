import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { SerialInfoPageRoutingModule } from './serial-info-routing.module';

import { SerialInfoPage } from './serial-info.page';
import { MaterialModule } from '../../material/material.module';
import { SharedModule } from '../../warranty-ui/shared-warranty-modules/shared.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    MaterialModule,
    IonicModule,
    SerialInfoPageRoutingModule,
    ReactiveFormsModule,
    SharedModule,
  ],
  declarations: [SerialInfoPage],
})
export class SerialInfoPageModule {}
