import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VocabularyController } from './vocabulary.controller';
import { VocabularyService } from './vocabulary.service';
import { VocabularyContextService } from './vocabulary-context.service';
import { VocabularyContextController } from './vocabulary-context.controller';
import { Vocabulary, UserVocabulary } from '../entities';

@Module({
  imports: [TypeOrmModule.forFeature([Vocabulary, UserVocabulary])],
  controllers: [VocabularyController, VocabularyContextController],
  providers: [VocabularyService, VocabularyContextService],
  exports: [VocabularyService, VocabularyContextService],
})
export class VocabularyModule {}

