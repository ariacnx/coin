-- Run this if you have an existing magic-link schema to migrate to email/password
alter table users alter column email drop not null;
alter table users add column if not exists password_hash text;
drop table if exists magic_links;
