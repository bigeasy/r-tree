## Sat Nov 14 22:28:05 CST 2020

Going to always have a root, so I suppose we start it empty somehow, `[ 0, 0, 0, 0 ]`?

Apparently, remove is going to be an operation on an item, but how do we
identify the item? Either we make the item a class or it has information in the
JSON that tells us what page it is in, the information that would be in the
class.

A first pass at this can be in memory to test split?

Found states and counties (and parishes), so we could use that as test data.
Start with Michigan and Louisiana, the two states I'm familiar with
geographically.

R-Trees have reinsertion as a concept. Re-insertion means involving some
arbitrary number of additional pages in a split or merge. Starting to think
about a WAL and if I do, then I have to think about having some form of MVCC.
The idea here is that items are added to a page but ignored if their version
number is not somehow committed. This allows us to replay a failed split or
merge.

However, that's not that much different from what we're already doing in Strata.
We can have new entries written to a stub and move the stub in place.

Although at this moment, I can't wrap my head around how to distribute writes
from one page to three other pages without some sort of lock on the pages. Since
we're not exposing the pages as nakedly as we are in Strata, maybe we will have
to add some sort of read/write lock to leaf pages.

Sounds easiest. Especially with the Trampoline interface. Only the housekeeping
strand can lock. All a lock is, is a promise that you wait on if it is not
`null`.

 * [States and Counties/Parishes](https://eric.clst.org/tech/usgeojson/).

## Sat Nov 14 22:28:00 CST 2020

Need to think about how to deal with rectangles that share points along the
edges. Do they intersect?

 * [Hilbert clustering](http://www.academia.edu/3027346/Clustering_in_Hilbert_R_Trees_A_study_on_Spatial_Indexing_in_R_Trees).
 * [Google implementation](https://code.google.com/p/pyrtree/source/browse/pyrtree/rtree.py)
 * [Neat 2D ideas](https://github.com/mourner/rbush/blob/master/rbush.js)
