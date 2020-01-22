import { Component, OnInit } from '@angular/core';
import { Location } from '@angular/common';
import { FormControl, FormGroup } from '@angular/forms';
import { Observable } from 'rxjs';
import { SettingsService } from './settings.service';
import { startWith, debounceTime } from 'rxjs/operators';
import { ToastController } from '@ionic/angular';
import {
  SHORT_DURATION,
  UPDATE_SUCCESSFUL,
  UPDATE_ERROR,
} from '../constants/app-string';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
})
export class SettingsPage implements OnInit {
  hideSASecret: boolean = true;

  companySettingsForm = new FormGroup({
    authServerURL: new FormControl(),
    appURL: new FormControl(),
    defaultCompany: new FormControl(),
    frontendClientId: new FormControl(),
    backendClientId: new FormControl(),
    serviceAccountUser: new FormControl(),
    serviceAccountSecret: new FormControl(),
  });

  companies: Observable<unknown[]> = this.companySettingsForm
    .get('defaultCompany')
    .valueChanges.pipe(
      debounceTime(500),
      startWith(''),
      this.service.relayCompaniesOperation(),
    );

  constructor(
    private readonly location: Location,
    private readonly service: SettingsService,
    private readonly toastController: ToastController,
  ) {}

  ngOnInit() {
    this.service.getSettings().subscribe({
      next: res => {
        this.companySettingsForm
          .get('authServerURL')
          .setValue(res.authServerURL);
        this.companySettingsForm.get('appURL').setValue(res.appURL);
        this.companySettingsForm
          .get('defaultCompany')
          .setValue(res.defaultCompany);
        this.companySettingsForm
          .get('frontendClientId')
          .setValue(res.frontendClientId);
        this.companySettingsForm
          .get('backendClientId')
          .setValue(res.backendClientId);
        this.companySettingsForm
          .get('serviceAccountUser')
          .setValue(res.serviceAccountUser);
        this.companySettingsForm
          .get('serviceAccountSecret')
          .setValue(res.serviceAccountSecret);
      },
    });
  }

  navigateBack() {
    this.location.back();
  }

  updateSettings() {
    this.service
      .updateSettings(
        this.companySettingsForm.get('authServerURL').value,
        this.companySettingsForm.get('appURL').value,
        this.companySettingsForm.get('defaultCompany').value,
        this.companySettingsForm.get('frontendClientId').value,
        this.companySettingsForm.get('backendClientId').value,
        this.companySettingsForm.get('serviceAccountUser').value,
        this.companySettingsForm.get('serviceAccountSecret').value,
      )
      .subscribe({
        next: success => {
          this.toastController
            .create({
              message: UPDATE_SUCCESSFUL,
              duration: SHORT_DURATION,
              showCloseButton: true,
            })
            .then(toast => toast.present());
        },
        error: error => {
          this.toastController
            .create({
              message: UPDATE_ERROR,
              duration: SHORT_DURATION,
              showCloseButton: true,
            })
            .then(toast => toast.present());
        },
      });
  }
}