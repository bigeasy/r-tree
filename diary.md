## Sat Nov 21 14:52:44 CST 2020

The simplicity of the write-ahead log makes me want to imagine something more
complex. What if that rollback file is deleted? Or corrupted? How would we
ensure that the tree is still somewhat reasonable?

Okay, so why is Strata okay? You do more than write and unlink a file. You
write, rename and unlink files aplenty. How is it worse that you have one file
instead of many? Too simple to trust? It's supposed to be the other way around.

The idea is that, if the rollback is missing or corrupted, you can still detect
the tree mutations as you navigate the tree. Basically, a half-complete tree
re-balance is detected and completed, a removal or append is simply lost, but
the tree is still valid.

Anyway, my first though in an indempoent-esque tree is to add leaf entries last.
That way tree is still structured correctly, the leaves can be found, or else
the leaves are missing. If the boxes of the branches get extended the tree is
still a valid r-tree.

To split you would write the split, maybe the set to be removed and the page id
to move them to, write that in the parent first. After the writes to the
children are complete you log the completion in the parent, which just knocks
out the split.

For merge we reinsert nodes to empty a leaf, so that means moving a node. It
gets added to one page and removed from another. We can't let it just get half
done because we'll have duplciates. I had visions of loging the page id and node
id of the move in the add and remove, then coming back to write that they'd
completed, knocking out the move references. This has a powerful chicken or the
egg vibe.

Of course, we could log the move the first common branch, or we could all the
moves in the first common branch. Perhaps since the moves will probably be
local, to nodes surrounding the node being drained, the common branch might be
the parent, which prior to writing this sentance I assumed it would always be
the root.

Anyway, log all the moves, knock them out. Thus, ordinary insert and remove is
append only, split and merge a logged in parent branch. You'd still have to
descend the tree to discover these issues, so we'd still want our simple
rollback file, so start there and we can add all this.

Note to self that I want a parent link in each page, but anyway.

Eventually my thoughts turn to simply traversing the tree and looking for
problems, the key problem being duplicate nodes, which we wouldn't be able to
detect, since entries are only unique in their page, so we'd have to provide
some sort of iterator to the user, one that presents each entry with entries
that have the same box, not grouped, but each entry. The disambiguation would be
on the part of the user using the parts.

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
