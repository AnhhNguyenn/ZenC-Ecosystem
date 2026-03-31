import { MigrationInterface, QueryRunner } from "typeorm";

export class DropUnstructuredColumns1710000000000 implements MigrationInterface {
    name = 'DropUnstructuredColumns1710000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Drop unstructured data columns from 'conversations' table safely
        await queryRunner.query(`
            ALTER TABLE "conversations"
            DROP COLUMN IF EXISTS "transcript",
            DROP COLUMN IF EXISTS "userTranscript",
            DROP COLUMN IF EXISTS "highlights",
            DROP COLUMN IF EXISTS "improvements",
            DROP COLUMN IF EXISTS "vietnameseAdvice";
        `);

        // Drop changeSnapshot from 'admin_audit_logs' safely
        await queryRunner.query(`
            ALTER TABLE "admin_audit_logs"
            DROP COLUMN IF EXISTS "changeSnapshot";
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Reverse operation if needed
        await queryRunner.query(`
            ALTER TABLE "conversations"
            ADD COLUMN IF NOT EXISTS "transcript" varchar,
            ADD COLUMN IF NOT EXISTS "userTranscript" varchar,
            ADD COLUMN IF NOT EXISTS "highlights" varchar,
            ADD COLUMN IF NOT EXISTS "improvements" varchar,
            ADD COLUMN IF NOT EXISTS "vietnameseAdvice" varchar;
        `);

        await queryRunner.query(`
            ALTER TABLE "admin_audit_logs"
            ADD COLUMN IF NOT EXISTS "changeSnapshot" varchar;
        `);
    }
}
