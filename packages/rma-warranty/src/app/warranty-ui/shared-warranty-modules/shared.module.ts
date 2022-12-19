import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ServiceInvoicesComponent } from './service-invoices/service-invoices.component';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { AppCommonModule } from '../../common/app-common.module';
import { MaterialModule } from '../../material/material.module';
import { RouterModule } from '@angular/router';
import { PrintSettingDialog } from './print-setting-dialog/print-setting-dialog';
import { KeyDownDetectorDirective } from './service-invoices/add-service-invoice/on-key-down-directive';

@NgModule({
  declarations: [
    ServiceInvoicesComponent,
    PrintSettingDialog,
    KeyDownDetectorDirective,
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    MaterialModule,
    HttpClientModule,
    AppCommonModule,
    RouterModule,
  ],
  exports: [
    ServiceInvoicesComponent,
    PrintSettingDialog,
    KeyDownDetectorDirective,
  ],
})
export class SharedModule {}
