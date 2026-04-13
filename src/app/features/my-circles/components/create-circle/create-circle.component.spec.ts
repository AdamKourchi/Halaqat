import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { CreateCircleComponent } from './create-circle.component';

describe('CreateCircleComponent', () => {
  let component: CreateCircleComponent;
  let fixture: ComponentFixture<CreateCircleComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [CreateCircleComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CreateCircleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
