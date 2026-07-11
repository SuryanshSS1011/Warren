-- Make warrens private by default (PRODUCT_PLAN §1.5): reading trails are intellectual-
-- privacy data, so a newly-saved warren is private until the owner explicitly publishes it.
-- The app already passes is_public=false on insert; this aligns the column default so any
-- other insert path is private-safe too. Existing rows are left untouched.
alter table warren alter column is_public set default false;
