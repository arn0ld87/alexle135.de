alter table contact_messages
  add column if not exists status text not null default 'open'
  check (status in ('open', 'answered', 'spam', 'follow_up'));

update contact_messages
set status = case when handled then 'answered' else 'open' end
where status = 'open';

create index if not exists contact_messages_status_idx
  on contact_messages (status);

