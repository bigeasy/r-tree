## Tue Dec 15 06:56:59 CST 2020

With the write-ahead log it would seem that things like moves become much
simplier. You remove from one page, add to another, but because of the
write-ahead structure, when either page load navigates they will see the add or
remove. When I started this paragraph I thought I'd be describing a special
structure they would both see, but no, one would see their remove and one would
see their add.

In the case of the r-tree we still need to descend pages to do a move which you
would imagine you would do in pairs to keep from holding onto too much cached
material, so you probably want to add to the write-ahead log that you're in the
middle of a re-distribution.

## Tue Dec 15 06:48:31 CST 2020

What we're really doing when we block appenders from housekeeping is not
blocking a strand from proceding, we're blocking the invocation of a user
function, and we're processing the enqueued information in the housekeeper.
Removing a keyed queue from a set of turnsitles does not have to block the
turnstile, we can puck the queue out of the "fracture" and into another. This
would be a method called intercept and it would return the entry and then you'd
have to release it.

## Tue Dec 15 06:32:41 CST 2020

Recall that Fracture had something to do with sharing turnstiles. I can see
deadlock in how this is apporached. If a merge needs to block three pages, if we
have two housekeeping threads we would need six appender threads. We would have
to be aware of this when we create our shared fractures.

## Mon Dec 14 15:50:30 CST 2020

Reloading. Trying to recall what was on my mind with `Fracture`. I was at
Robert's on Elysian Fields, standing in line, thinking about it. I thought about
it pretty hard and there's probably something there that folds back into Strata.

All I can recall is that there was a dependency concept, that a queue of events
would not be able to wait on itself. The housekeeping queue could not submit
appends back into itself. There would have to be enough workers in an append
queue to accommodate it.

Looking at Strata there is the bit where all the queued writes are gathered
so they can be written after a page split or merge. The split or merge was based
on the page in memory. The page in memory is based on any of the appends that
are in memory. Those appends need to be flushed with split or merge. They need
to be synchronously removed from the queued writes prior to any asynchronous
action. Once asynchronous actions start, new writes can be appended to their
queues.

It is hard to describe, but it is pretty well understood if I look at the code
for just a few minutes. I believe Fracture is trying to capture this in an
interface.

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
