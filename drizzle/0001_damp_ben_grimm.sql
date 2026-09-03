CREATE UNIQUE INDEX `uq_active_tenancy_room` ON `tenancies` (`owner_key`,`room_id`) WHERE "tenancies"."status" IN ('active','notice');
--> statement-breakpoint
PRAGMA optimize;
