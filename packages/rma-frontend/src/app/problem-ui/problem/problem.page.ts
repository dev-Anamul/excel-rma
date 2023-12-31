import { Component, OnInit, ViewChild } from '@angular/core';
import { Location } from '@angular/common';
import { ProblemService } from '../services/problem/problem.service';
import { ProblemDataSource } from './problem-datasource';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { PopoverController } from '@ionic/angular';
import { AddProblemPage } from '../add-problem/add-problem.page';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-problem',
  templateUrl: './problem.page.html',
  styleUrls: ['./problem.page.scss'],
})
export class ProblemPage implements OnInit {
  @ViewChild(MatPaginator, { static: true }) paginator: MatPaginator;
  @ViewChild(MatSort, { static: true }) sort: MatSort;
  dataSource: ProblemDataSource;
  displayedColumns = ['sr_no', 'problem_name', 'delete'];
  search: string = '';

  constructor(
    private readonly location: Location,
    private readonly problemService: ProblemService,
    private readonly popoverController: PopoverController,
    private readonly route: ActivatedRoute,
  ) {}

  ngOnInit() {
    this.route.params.subscribe(() => {
      this.paginator.firstPage();
    });
    this.dataSource = new ProblemDataSource(this.problemService);
    this.dataSource.loadItems();
  }

  navigateBack() {
    this.location.back();
  }

  async addProblem() {
    const popover = await this.popoverController.create({
      component: AddProblemPage,
      componentProps: {
        passedFrom: 'add',
      },
    });

    await popover.present();
    popover.onDidDismiss().then(res => {
      if (res.data.success)
        this.dataSource.loadItems(
          this.search,
          this.sort.direction,
          this.paginator.pageIndex,
          this.paginator.pageSize,
        );
    });
  }

  async updateProblem(uuid: string) {
    const popover = await this.popoverController.create({
      component: AddProblemPage,
      componentProps: {
        passedFrom: 'update',
        uuid,
      },
    });

    await popover.present();
    popover.onDidDismiss().then(res => {
      if (res.data.success)
        this.dataSource.loadItems(
          this.search,
          this.sort.direction,
          this.paginator.pageIndex,
          this.paginator.pageSize,
        );
    });
  }

  deleteProblem(uuid: string) {
    this.problemService.deleteProblem(uuid).subscribe({
      next: () => {
        this.dataSource.loadItems(
          this.search,
          this.sort.direction,
          this.paginator.pageIndex,
          this.paginator.pageSize,
        );
      },
    });
  }

  setFilter() {
    this.paginator.pageIndex = 0;
    this.paginator.pageSize = 30;

    this.dataSource.loadItems(
      this.search,
      this.sort.direction,
      this.paginator.pageIndex,
      this.paginator.pageSize,
    );
  }

  getUpdate(event: any) {
    this.paginator.pageIndex = event?.pageIndex || 0;
    this.paginator.pageSize = event?.pageSize || 30;

    this.dataSource.loadItems(
      this.search,
      this.sort.direction,
      this.paginator.pageIndex,
      this.paginator.pageSize,
    );
  }
}
