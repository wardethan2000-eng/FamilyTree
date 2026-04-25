CREATE TABLE "branches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tree_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"sort_weight" integer DEFAULT 0 NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"accent" varchar(30),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memory_branches" (
	"memory_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	CONSTRAINT "memory_branches_memory_id_branch_id_pk" PRIMARY KEY("memory_id","branch_id")
);
--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_tree_id_trees_id_fk" FOREIGN KEY ("tree_id") REFERENCES "public"."trees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_branches" ADD CONSTRAINT "memory_branches_memory_id_memories_id_fk" FOREIGN KEY ("memory_id") REFERENCES "public"."memories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_branches" ADD CONSTRAINT "memory_branches_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "branches_tree_idx" ON "branches" USING btree ("tree_id");--> statement-breakpoint
CREATE INDEX "branches_is_default_idx" ON "branches" USING btree ("tree_id","is_default");--> statement-breakpoint
CREATE INDEX "memory_branches_branch_idx" ON "memory_branches" USING btree ("branch_id");