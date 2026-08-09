# Blog Publishing

This context defines the content that can be published by the blog and the vocabulary used to organize it.

## Articles

**Published Post**:
A validated, non-draft article that is eligible for public routes and generated artifacts.
_Avoid_: Post entry, content item

**Post Slug**:
The stable, case-preserving ASCII identifier of a Published Post. It may contain letters, numbers, hyphens, and underscores.
_Avoid_: Filename, path

**Calendar Date**:
The timezone-free `YYYY-MM-DD` date assigned to a Published Post.
_Avoid_: Timestamp, publish time

**Canonical Tag**:
The normalized identity of a tag. Compatibility characters and whitespace are normalized, and known equivalent labels resolve to one canonical label.
_Avoid_: Raw tag, display tag

**Tag Archive**:
A public collection formed when the same Canonical Tag is referenced by at least two distinct Published Posts.
_Avoid_: Tag page, tag occurrence

## Photos

**Photo Catalog**:
The public, authoritative record of published photos, their capture months, and their Album membership.
_Avoid_: Photo index, gallery JSON

**Capture Month**:
The calendar month encoded by a photo's timezone-aware capture date and used to group it in the Photo Catalog.
_Avoid_: Upload month, shard

**Album**:
A named logical collection that references published photos without owning or duplicating their media.
_Avoid_: Folder, directory

**Retired Photo**:
A photo removed from the live Photo Catalog whose immutable objects remain recorded until the cache grace period ends and garbage collection succeeds.
_Avoid_: Deleted photo, orphan
