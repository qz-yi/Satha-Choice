CREATE TABLE "drivers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"password" text NOT NULL,
	"city" text NOT NULL,
	"vehicle_type" text NOT NULL,
	"plate_number" text NOT NULL,
	"wallet_balance" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"is_online" boolean DEFAULT false,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"last_lat" text,
	"last_lng" text,
	"avatar_url" text,
	CONSTRAINT "drivers_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"sender_id" integer NOT NULL,
	"sender_type" text NOT NULL,
	"sender_name" text NOT NULL,
	"content" text NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_name" text DEFAULT 'زبون',
	"customer_phone" text DEFAULT '07700000000',
	"customer_wallet_balance" numeric(10, 2) DEFAULT '0.00',
	"vehicle_type" text NOT NULL,
	"price" text NOT NULL,
	"location" text DEFAULT 'لم يحدد العنوان',
	"pickup_address" text,
	"pickup_lat" text,
	"pickup_lng" text,
	"destination" text DEFAULT 'غير محدد',
	"dest_lat" text,
	"dest_lng" text,
	"city" text,
	"scheduled_at" timestamp,
	"status" text DEFAULT 'pending',
	"driver_id" integer,
	"created_at" timestamp DEFAULT now(),
	"rating" integer,
	"payment_method" text,
	"is_refunded" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"commission_amount" integer DEFAULT 1000 NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"driver_id" integer,
	"user_id" integer,
	"amount" numeric(10, 2) NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"zain_cash_id" text,
	"msisdn" text,
	"operation_id" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"phone" text NOT NULL,
	"password" text NOT NULL,
	"city" text DEFAULT 'غير محدد',
	"wallet_balance" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	CONSTRAINT "users_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_order_id_requests_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;