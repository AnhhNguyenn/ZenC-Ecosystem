import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTotalXpToUser1710000000001 implements MigrationInterface {
    name = 'AddTotalXpToUser1710000000001'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "users"
            ADD COLUMN IF NOT EXISTS "totalXp" integer NOT NULL DEFAULT 0;
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_users_totalXp" ON "users" ("totalXp");
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_users_tokenBalance" ON "users" ("tokenBalance");
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DROP INDEX IF EXISTS "public"."IDX_users_tokenBalance";
        `);

        await queryRunner.query(`
            DROP INDEX IF EXISTS "public"."IDX_users_totalXp";
        `);

        await queryRunner.query(`
            ALTER TABLE "users"
            DROP COLUMN IF EXISTS "totalXp";
        `);
    }
}
