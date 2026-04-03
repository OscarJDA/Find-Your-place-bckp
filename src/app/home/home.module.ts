import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { HomePage } from './home.page';

import { HomePageRoutingModule } from './home-routing.module';
import { FinancialSimulatorComponent } from './financial-simulator/financial-simulator.component';
import { NegociosPage } from '../negocios/negocios.page';
import { AnalisisPage } from '../analisis/analisis.page';


@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    HomePageRoutingModule,
    FinancialSimulatorComponent,
    NegociosPage,
    AnalisisPage
  ],
  declarations: [HomePage]
})
export class HomePageModule { }
