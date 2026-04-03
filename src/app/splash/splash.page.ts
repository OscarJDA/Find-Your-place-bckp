import { Component, OnInit } from '@angular/core';
import { NavController } from '@ionic/angular';

@Component({
  selector: 'app-splash',
  templateUrl: './splash.page.html',
  styleUrls: ['./splash.page.scss'],
  standalone: false,
})
export class SplashPage implements OnInit {

  constructor(private navCtrl: NavController) { }

  ngOnInit() {
    setTimeout(() => {
      this.navCtrl.navigateRoot('/home', { animated: true, animationDirection: 'forward' });
    }, 3000); // 3 seconds duration
  }

}
