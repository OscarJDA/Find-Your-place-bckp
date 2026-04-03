import { Component, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController, IonContent } from '@ionic/angular';

@Component({
    selector: 'app-financial-simulator',
    templateUrl: './financial-simulator.component.html',
    styleUrls: ['./financial-simulator.component.scss'],
    standalone: true,
    imports: [CommonModule, FormsModule, IonicModule]
})
export class FinancialSimulatorComponent {
    @ViewChild(IonContent) content!: IonContent;

    rent: number | null = null;
    investment: number | null = null;
    margin: number | null = null;
    ticket: number | null = null;
    sales: number | null = null;

    roi: number | null = null;
    breakEven: number | null = null;
    recoveryTime: number | null = null;

    constructor(private modalCtrl: ModalController) { }

    dismiss() {
        this.modalCtrl.dismiss();
    }

    calculate() {
        if (!this.rent || !this.investment || !this.margin || !this.sales) {
            // Basic validation
            return;
        }

        const marginDecimal = this.margin / 100;

        // Monthly Gross Profit = Sales * Margin%
        const monthlyGrossProfit = this.sales * marginDecimal;

        // Monthly Net Profit = Gross Profit - Rent
        const monthlyNetProfit = monthlyGrossProfit - this.rent;

        if (this.investment > 0) {
            // Annual ROI = (Annual Net Profit / Investment) * 100
            this.roi = ((monthlyNetProfit * 12) / this.investment) * 100;

            // Recovery Time (Months)
            if (monthlyNetProfit > 0) {
                this.recoveryTime = this.investment / monthlyNetProfit;
            } else {
                this.recoveryTime = -1; // Negative profit
            }
        } else {
            this.roi = 0;
            this.recoveryTime = 0;
        }

        // Break-even Point (Sales needed to cover Rent)
        // Sales * Margin% = Rent  => Sales = Rent / Margin%
        if (marginDecimal > 0) {
            this.breakEven = this.rent / marginDecimal;
        } else {
            this.breakEven = 0;
        }

        // Auto scroll to results to ensure they are visible
        setTimeout(() => {
            if (this.content) {
                this.content.scrollToBottom(500);
            }
        }, 300);
    }

    formatCurrency(value: number | null): string {
        if (value === null) return '-';
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value);
    }

    isFormValid(): boolean {
        return !!(this.rent && this.investment && this.margin && this.sales);
    }
}
