import { Module } from '@nestjs/common';
import { ECardController } from './ecard.controller';
import { ECardService } from './ecard.service';
import { SavedDesignsModule } from '../saved-designs/saved-designs.module';

@Module({
    imports: [SavedDesignsModule],
    controllers: [ECardController],
    providers: [ECardService],
    exports: [ECardService],
})
export class ECardModule { }
