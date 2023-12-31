import { Component, OnInit } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { SalesService } from '../services/sales.service';
import { SalesInvoiceDetails } from './details/details.component';
import { PopoverController } from '@ionic/angular';
import { PrintComponent } from './print/print.component';
import { ViewSalesInvoiceSubjectService } from './view-sales-invoice-subject.service';
import { switchMap } from 'rxjs/operators';
import { PERMISSION_STATE } from '../../constants/permission-roles';

@Component({
  selector: 'app-view-sales-invoice',
  templateUrl: './view-sales-invoice.page.html',
  styleUrls: ['./view-sales-invoice.page.scss'],
})
export class ViewSalesInvoicePage implements OnInit {
  selectedSegment: any;
  sales_invoice_name: string = '';
  invoiceUuid: string = '';
  disableReturnsTab: boolean;
  showCreditNotesTab: boolean;
  status: string = '';
  permissionState = PERMISSION_STATE;

  constructor(
    private readonly location: Location,
    private readonly route: ActivatedRoute,
    private readonly salesService: SalesService,
    private readonly router: Router,
    private readonly popoverController: PopoverController,
    private readonly siSubject: ViewSalesInvoiceSubjectService,
  ) {}

  ngOnInit() {
    this.selectedSegment = 0;
    this.invoiceUuid = this.route.snapshot.params.invoiceUuid;
    this.siSubject.data
      .pipe(
        switchMap(data => {
          return this.salesService.getSalesInvoice(
            data.siUuid || this.invoiceUuid,
          );
        }),
      )
      .subscribe({
        next: (res: SalesInvoiceDetails) => {
          this.updateView(res);
        },
        error: error => {},
      });
    this.salesService.getSalesInvoice(this.invoiceUuid).subscribe({
      next: (res: SalesInvoiceDetails) => {
        this.updateView(res);
      },
    });
  }

  showJobs() {
    this.router.navigateByUrl(`jobs?parent=${this.sales_invoice_name}`);
  }

  async showPrintOptions(ev) {
    const popover = await this.popoverController.create({
      component: PrintComponent,
      componentProps: {
        invoice_name: this.sales_invoice_name,
      },
      event: ev,
      translucent: false,
    });

    return await popover.present();
  }

  navigateBack() {
    this.location.back();
  }

  updateView(res: SalesInvoiceDetails) {
    this.showCreditNotesTab = res.returned_items.length ? false : true;
    this.disableReturnsTab =
      Object.keys(res.delivered_items_map).length === 0 ? false : true;
    this.sales_invoice_name = res.name;
    this.status = res.status;
  }
}
