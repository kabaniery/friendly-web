import {MainPostCard} from '@/app/community/replies/main-post';
import {communityPosts} from '@/services/community-posts-service';
import {CommunityPostId} from '@/network/friendly-client';
import {CommunityDetailsResponse} from '@/network/friendly-client';
import {Button} from '@/components/ui/button';
import {useInfiniteQuery} from '@tanstack/react-query';
import {Loader2, MessageCircle, AlertCircle} from 'lucide-react';
import {useTranslations} from 'use-intl';
import React, {useRef, useEffect} from 'react';
import {useNavigate, useParams} from 'react-router';
import {CommunityPostCard} from '../post';
import {useAppContext} from '@/app.context';

export function RepliesPage() {
    const t = useTranslations('replies');
    const navigate = useNavigate();
    const app = useAppContext();

    const {id} = useParams();
    const idInt = id ? (Number(id) as CommunityPostId) : null;
    useEffect(() => {
        if (idInt === null || Number.isNaN(idInt)) {
            void navigate('/not-found');
        }
    }, [idInt]);
    if (!idInt) return;

    const replyTo = communityPosts.useDetails(app, idInt);

    let content;

    if (replyTo.cache === 'empty') {
        content = (
            <div className="flex h-[50vh] w-full items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
            </div>
        );
    } else if (replyTo.cache !== 'ok') {
        content = (
            <div className="flex flex-col h-[50vh] gap-4 w-full items-center justify-center">
                <AlertCircle className="h-10 w-10 animate-pulse text-foreground/80" />
                <p className="text-center">{t('unknown_error')}</p>
                <Button
                    variant="outline"
                    className="mt-2"
                    onClick={() =>
                        void communityPosts.invalidateDetails(app, idInt)
                    }
                >
                    {t('retry')}
                </Button>
            </div>
        );
    } else {
        content = <ReplyContent id={idInt} replyTo={replyTo.data!} />;
    }

    return (
        <div
            key={idInt}
            className="flex flex-col w-full h-full max-w-2xl mx-auto"
        >
            {content}
        </div>
    );
}

interface ReplyContentProps {
    id: CommunityPostId;
    replyTo: CommunityDetailsResponse;
}

function ReplyContent({id, replyTo}: ReplyContentProps) {
    const app = useAppContext();
    const t = useTranslations('replies');

    replyTo = {
        ...replyTo,
        post: communityPosts.usePost(replyTo.post.id).data!,
    };

    const upstreamRef = useRef<HTMLDivElement>(null);
    const postRef = useRef<HTMLDivElement>(null);
    const scrollableRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let shouldBreak = false;
        void (async () => {
            for (const reply of replyTo.replies.data) {
                if (shouldBreak) break;
                await communityPosts.prefetchDetails(app, reply.id, {
                    staleTime: Infinity,
                });
            }
        })();
        void (async () => {
            for (const upstream of replyTo.upstream) {
                if (shouldBreak) break;
                await communityPosts.prefetchDetails(app, upstream.id, {
                    staleTime: Infinity,
                });
            }
        })();
        return () => {
            shouldBreak = true;
        };
    }, [replyTo]);

    useEffect(() => {
        const upstream = upstreamRef.current;
        if (upstream && replyTo.replies.data.length > 0) {
            upstream.scrollIntoView({
                behavior: 'instant',
                block: 'start',
                inline: 'nearest',
            });
        }
        const post = postRef.current;
        const scrollable = scrollableRef.current;
        if (post && scrollable && replyTo.replies.data.length === 0) {
            const fits =
                scrollable.getBoundingClientRect().height >=
                post.getBoundingClientRect().height;
            if (fits) {
                post.scrollIntoView({
                    behavior: 'instant',
                    block: 'end',
                    inline: 'nearest',
                });
            } else {
                post.scrollIntoView({
                    behavior: 'instant',
                    block: 'start',
                    inline: 'nearest',
                });
            }
        }
    }, [id]);

    const postsQuery = useInfiniteQuery({
        ...communityPosts.repliesOptions(app, replyTo.post),
    });

    const pages = postsQuery.data?.pages ?? [];
    const posts = pages.flatMap(p => p.data);

    const loadMore = () => {
        if (postsQuery.hasNextPage && !postsQuery.isFetchingNextPage) {
            void postsQuery.fetchNextPage();
        }
    };

    let upstream;

    if (replyTo.upstream.length > 0) {
        upstream = (
            <>
                <div className="flex flex-col gap-2">
                    {replyTo.upstream.map(post => (
                        <CommunityPostCard
                            key={`${replyTo.post.id}-${post.id}`}
                            postId={post.id}
                            minimizeToolbar={true}
                        />
                    ))}
                    <div
                        ref={upstreamRef}
                        className="text-sm font-semibold uppercase text-foreground scroll-m-10"
                    />
                </div>
            </>
        );
    } else {
        upstream = null;
    }

    let replies;

    if (posts.length === 0) {
        replies = (
            <div className="flex flex-col gap-2 mt-6 w-full items-center justify-center px-6 text-center">
                <MessageCircle className="w-12 h-12 text-muted-foreground" />
                <p className="text-base font-semibold text-foreground">
                    {t('no-replies')}
                </p>
                <p className="max-w-xs text-sm text-muted-foreground">
                    {t('no-replies-desc')}
                </p>
                <div className="h-[50dvh] w-full" />
            </div>
        );
    } else {
        replies = (
            <div className="w-full min-h-[70dvh] flex flex-col gap-4">
                <p className="text-sm font-semibold uppercase text-foreground">
                    {t('replies')}
                </p>
                {posts.map(post => (
                    <CommunityPostCard
                        key={`${replyTo.post.id}-${post.id}`}
                        postId={post.id}
                        minimizeToolbar={false}
                        minimizeText={true}
                        isReply={true}
                    />
                ))}
            </div>
        );
    }

    return (
        <div
            ref={scrollableRef}
            className="h-full w-full p-4 overflow-y-auto scrollbar-none"
        >
            {upstream}
            <MainPostCard postRef={postRef} details={replyTo} />
            {replies}
            <div hidden={!postsQuery.hasNextPage}>
                <Button
                    variant="ghost"
                    className="text-accent-foreground hover:cursor-pointer"
                    onClick={loadMore}
                    disabled={postsQuery.isFetchingNextPage}
                >
                    {postsQuery.isFetchingNextPage ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        t('load-more')
                    )}
                </Button>
            </div>
        </div>
    );
}
